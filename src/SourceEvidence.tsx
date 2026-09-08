import type { HubState } from '../shared/types';

export function SourceStatus({ state, itemId }: { state: HubState; itemId: string }) {
  const source = state.sourceRecords?.find(record => record.itemId === itemId);
  if (!source) return null;
  return <p className="muted small-text" style={{ margin: '6px 0', maxWidth: 300 }}><strong>Tracker: {source.sourceStatus || 'Not stated'}</strong>{source.disposition === 'needs_review' && <span> · Status to confirm</span>}</p>;
}

export default function SourceEvidence({ state, itemId, onNavigate }: { state: HubState; itemId: string; onNavigate?: () => void }) {
  const source = state.sourceRecords?.find(record => record.itemId === itemId);
  if (!source) return null;
  const document = state.sourceDocuments?.find(record => record.id === source.documentId);
  return <details className="notice" style={{ display: 'block', margin: '16px 0', overflowWrap: 'anywhere' }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Tracker position: {source.sourceStatus || 'Not stated'}</summary>
    <p>{document?.name ?? source.documentId} · {source.locator}</p>
    <p>{source.mappingNote}</p>
    <div className="form-grid"><div><strong>Owner in source</strong><p>{source.sourceOwner || 'Not stated'}</p></div><div><strong>Dates in source</strong><p>{source.sourceDates || 'Not stated'}</p></div></div>
    {source.resolutionNotes && <p style={{ whiteSpace: 'pre-wrap' }}>{source.resolutionNotes}</p>}
    {source.syncNote && <p role="status"><strong>{source.syncNote}</strong></p>}
    <a className="text-button" href="#sources" onClick={onNavigate}>Review project sources</a>
  </details>;
}
