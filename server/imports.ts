import ExcelJS from 'exceljs';
import { createHash, randomUUID } from 'node:crypto';
import { HttpError, itemSchema, requireThat } from './domain.js';
import { SOFTWARE_STAGES, GENERAL_STAGES, type HubState, type ImportPreview, type ImportRow, type WorkItem } from '../shared/types.js';

const fields = ['title', 'description', 'workstreamId', 'ownerId', 'currentOwnerId', 'kind', 'category', 'priority', 'dueDate', 'baselineDate', 'acceptanceCriteria', 'nextAction', 'clientSummary', 'clientVisible', 'tags', 'stage'] as const;
export function csvEncode(rows: unknown[][]) { return '\ufeff' + rows.map(row => row.map(value => {
  let cell = String(value ?? '');
  if (/^[=+@\-\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}).join(',')).join('\r\n'); }
function csvParse(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  const value = text.replace(/^\ufeff/, '');
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"') { if (quoted && value[i + 1] === '"') { cell += '"'; i++; } else { requireThat(quoted || !cell, 'Malformed CSV quoting.'); quoted = !quoted; } }
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if (c === '\r' && value[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  requireThat(!quoted, 'CSV contains an unclosed quoted field.');
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) throw new HttpError(400, 'Spreadsheet formulas are not imported. Paste values first.');
    if ('richText' in value) return value.richText.map(v => v.text).join('');
    if ('text' in value) return String(value.text);
    return '';
  }
  return String(value);
}
export async function previewImport(state: HubState, filename: string, content: string, mapping: Record<string, string> | undefined): Promise<ImportPreview> {
  requireThat(/\.(xlsx|csv)$/i.test(filename), 'Use a CSV or XLSX file.');
  requireThat(/^[A-Za-z0-9+/=\r\n]+$/.test(content), 'Invalid file encoding.');
  const buffer = Buffer.from(content, 'base64');
  requireThat(buffer.length <= 5 * 1024 * 1024, 'Import files must be under 5 MB.');
  let table: string[][];
  if (/\.csv$/i.test(filename)) table = csvParse(buffer.toString('utf8'));
  else {
    const workbook = new ExcelJS.Workbook();
    try { await workbook.xlsx.load(buffer as any); } catch { throw new HttpError(400, 'Unable to read this workbook. Use an unencrypted XLSX file.'); }
    requireThat(workbook.worksheets.length > 0, 'The workbook has no worksheet.');
    const sheet = workbook.worksheets[0];
    requireThat(sheet.rowCount <= 501 && sheet.columnCount <= 40, 'Imports support up to 500 data rows and 40 columns.');
    table = [];
    sheet.eachRow(row => { table.push(Array.from({ length: sheet.columnCount }, (_, i) => cellText(row.getCell(i + 1).value))); });
  }
  requireThat(table.length >= 2 && table.length <= 501, 'Include a header and between 1 and 500 data rows.');
  const headers = table[0].map(h => h.trim());
  requireThat(headers.length <= 40 && headers.every(Boolean) && new Set(headers).size === headers.length, 'Use distinct, nonempty column headers (maximum 40).');
  const aliases: Record<string, string> = { workstream: 'workstreamId', owner: 'ownerId', 'current owner': 'currentOwnerId', 'due date': 'dueDate', 'baseline date': 'baselineDate', 'acceptance criteria': 'acceptanceCriteria', 'next action': 'nextAction', 'client summary': 'clientSummary', 'client visible': 'clientVisible', name: 'title', task: 'title', status: 'stage' };
  const selected: Record<string, string> = {};
  if (mapping) {
    for (const [from, to] of Object.entries(mapping)) {
      // Support both header->field and field->header mappings from the UI.
      if (headers.includes(from) && fields.includes(to as any)) selected[from] = to;
      else if (fields.includes(from as any) && headers.includes(to)) selected[to] = from;
      else if (to) throw new HttpError(400, `Invalid mapping: ${from} → ${to}`);
    }
  } else for (const h of headers) { const match = fields.find(f => f.toLowerCase() === h.toLowerCase()) ?? aliases[h.toLowerCase()]; if (match) selected[h] = match; }
  requireThat(Object.values(selected).includes('title'), 'Map a column to title.');
  const duplicateKeys = new Set(state.items.map(i => `${i.workstreamId}|${i.title.trim().toLowerCase()}`));
  const rows: ImportRow[] = table.slice(1).map((cells, index) => {
    const raw: Record<string, unknown> = {};
    headers.forEach((h, i) => { if (selected[h]) raw[selected[h]] = (cells[i] ?? '').trim(); });
    for (const key of ['workstreamId', 'ownerId', 'currentOwnerId'] as const) {
      const list = key === 'workstreamId' ? state.workstreams : state.members;
      const text = String(raw[key] ?? '');
      const record = list.find(r => r.id === text || r.name.toLowerCase() === text.toLowerCase());
      if (record) raw[key] = record.id;
    }
    raw.currentOwnerId ||= raw.ownerId;
    raw.stage ||= 'Backlog';
    if (!raw.kind && SOFTWARE_STAGES.includes(raw.stage as any) && !GENERAL_STAGES.includes(raw.stage as any)) raw.kind = 'software';
    raw.tags = String(raw.tags ?? '').split(/[;|]/).map(v => v.trim()).filter(Boolean);
    raw.clientVisible = ['true', 'yes', '1'].includes(String(raw.clientVisible ?? '').toLowerCase());
    const candidate = { description: '', kind: 'general', category: 'action', priority: 'Medium', baselineDate: '', dueDate: '', acceptanceCriteria: '', nextAction: '', clientSummary: '', evidenceLinks: [], blocked: false, blockReason: '', ...raw };
    // A supplied commitment establishes a baseline; an omitted date stays unknown.
    candidate.baselineDate ||= String(candidate.dueDate ?? '');
    const validated = itemSchema.safeParse(candidate);
    const errors = validated.success ? [] : validated.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
    const stages = candidate.kind === 'software' ? SOFTWARE_STAGES : GENERAL_STAGES;
    if (!stages.includes(raw.stage as never)) errors.push('Stage is not recognized for this workflow.');
    if (!state.workstreams.some(w => w.id === raw.workstreamId)) errors.push('Workstream is not recognized.');
    if (!state.members.some(m => m.id === raw.ownerId && m.role !== 'executive')) errors.push('Owner is not a delivery team member.');
    if (!state.members.some(m => m.id === raw.currentOwnerId && m.role !== 'executive')) errors.push('Current owner is not a delivery team member.');
    const key = `${raw.workstreamId}|${String(raw.title ?? '').toLowerCase()}`;
    const duplicate = duplicateKeys.has(key);
    if (!errors.length) duplicateKeys.add(key);
    return { line: index + 2, item: { ...(validated.success ? validated.data : candidate), stage: raw.stage } as Partial<WorkItem>, errors, duplicate };
  });
  return { id: randomUUID(), headers, mapping: Object.fromEntries(Object.entries(selected).map(([header, field]) => [field, header])), rows, validCount: rows.filter(r => !r.errors.length && !r.duplicate).length, invalidCount: rows.filter(r => r.errors.length).length, duplicateCount: rows.filter(r => r.duplicate).length };
}
export function importFingerprint(previewId: string, line: number) { return createHash('sha256').update(`${previewId}:${line}`).digest('hex'); }
export async function exportWorkbook(state: HubState) {
  const book = new ExcelJS.Workbook(); book.creator = 'Phase Two Delivery Hub';
  const add = (name: string, records: Record<string, unknown>[], keys: string[]) => {
    const sheet = book.addWorksheet(name); sheet.addRow(keys);
    records.forEach(record => sheet.addRow(keys.map(k => Array.isArray(record[k]) ? (record[k] as unknown[]).join('; ') : String(record[k] ?? ''))));
    sheet.getRow(1).font = { bold: true }; sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.columns.forEach(c => { c.width = 24; });
  };
  add('Backlog', state.items as unknown as Record<string, unknown>[], ['id', ...fields, 'blocked', 'blockReason', 'cycle', 'version']);
  add('Registers', state.registers as unknown as Record<string, unknown>[], ['id', 'type', 'title', 'workstreamId', 'ownerId', 'dueDate', 'priority', 'status', 'detail', 'nextAction', 'clientSummary']);
  add('Milestones', state.milestones as unknown as Record<string, unknown>[], ['id', 'title', 'ownerId', 'baselineDate', 'forecastDate', 'status', 'notes']);
  return Buffer.from(await book.xlsx.writeBuffer());
}
export function exportCsv(state: HubState) { const keys = ['id', ...fields, 'blocked', 'blockReason', 'cycle']; return csvEncode([keys, ...state.items.map(item => keys.map(key => (item as any)[key]))]); }
