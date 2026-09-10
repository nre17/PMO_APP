import path from 'node:path';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { Store } from './db.js';
import { createPortfolioState } from './portfolio-seed.js';
import { applyIntake, intakeBundleSchema, previewIntake } from './intake.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const positional = args.filter(arg => arg !== '--apply');
if (positional.length !== 2 || positional.some(arg => arg.startsWith('--'))) throw Error('Usage: tsx server/intake-cli.ts BUNDLE.json .data/client [--apply]');
const workspace = path.resolve('.');
async function inside(relative: string, root: string) {
  const resolved = path.resolve(relative), base = path.resolve(root);
  const child = path.relative(base, resolved);
  if (!child || child === '..' || child.startsWith('..' + path.sep) || path.isAbsolute(child)) throw Error('Intake paths must stay inside the selected local workspace directory.');
  // Reject junctions and symlinks so a local alias cannot target a preview store
  // or a location outside this workspace under a different ownership lock.
  let candidate = workspace;
  for (const segment of path.relative(workspace, resolved).split(path.sep)) {
    candidate = path.join(candidate, segment);
    try { if ((await lstat(candidate)).isSymbolicLink()) throw Error('Intake paths cannot pass through a symlink or junction.'); }
    catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  }
  return resolved;
}
const bundlePath = await inside(positional[0], path.join(workspace, 'artifacts'));
const dataDir = await inside(positional[1], path.join(workspace, '.data'));
const fold = (value: string) => process.platform === 'win32' ? value.toLowerCase() : value;
if (['.data/pmo', '.data/portfolio'].some(relative => fold(dataDir) === fold(path.resolve(relative)) || fold(dataDir).startsWith(fold(path.resolve(relative)) + path.sep))) throw Error('Use a separate client store; preview stores are preserved.');
const input = intakeBundleSchema.parse(JSON.parse(await readFile(bundlePath, 'utf8')));
let entries: string[] = [];
try { entries = await readdir(dataDir); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
if (entries.length && !entries.includes('PG_VERSION')) throw Error('The selected directory is not an existing local project database.');
const initialState = createPortfolioState();
if (!entries.length) {
  const preview = previewIntake(initialState, input, 'preview-pmo', new Date().toISOString());
  if (!apply) { console.log(JSON.stringify({ mode: 'preview', ...preview.result })); process.exit(0); }
}
const store = await Store.open({ dataDir, initialState });
try {
  const state = await store.read();
  const actor = state.members.find(member => member.role === 'pmo');
  if (!actor) throw Error('The project store needs a PMO actor.');
  const now = new Date().toISOString();
  const preview = previewIntake(state, input, actor.id, now);
  if (!apply) console.log(JSON.stringify({ mode: 'preview', ...preview.result }));
  else {
    const backupDir = path.join(workspace, 'artifacts', 'intake-backups');
    await mkdir(backupDir, { recursive: true });
    const backup = path.join(backupDir, `before-${Date.now()}.json`);
    await writeFile(backup, JSON.stringify(state), { flag: 'wx' });
    const result = await store.mutate(current => applyIntake(current, input, actor.id, now));
    console.log(JSON.stringify({ mode: 'applied', backup, ...result }));
  }
} finally { await store.close(); }
