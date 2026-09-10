import { useEffect, useState } from 'react';
import { ArrowLeft, FileCheck2, Printer } from 'lucide-react';
import type { Bootstrap } from '../shared/types';
import { api } from './api';
import { formatDate } from './ui';
import { resolveDemoEvidence, type DemoEvidenceRecord } from './demo-evidence-model';
import './demo-evidence.css';

export default function DemoEvidence() {
  const [record, setRecord] = useState<DemoEvidenceRecord>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const reference = decodeURIComponent(location.pathname.slice('/evidence/'.length));
        const { state } = await api<Bootstrap>('/api/bootstrap');
        const resolved = resolveDemoEvidence(state, reference);
        if (!resolved) throw new Error('This reference is not part of the prepared review evidence. Open the workspace to inspect the original record.');
        if (active) setRecord(resolved);
      } catch (caught) { if (active) setError((caught as Error).message); }
    }
    void load(); return () => { active = false; };
  }, []);
  return <main className="review-evidence">
    <nav className="review-evidence-toolbar" aria-label="Evidence actions"><a className="button secondary" href="/#work"><ArrowLeft size={16}/>Back to workspace</a><button className="button secondary" disabled={!record} onClick={() => window.print()}><Printer size={16}/>Print specimen</button></nav>
    {error ? <div className="notice notice-warning" role="alert">{error}</div> : !record ? <p role="status">Opening the evidence record…</p> : <article>
      <header><span className="review-evidence-label"><FileCheck2 size={16}/>Manager review · Illustrative evidence</span><h1>{record.title}</h1><p>{record.useCase} · {record.kind}</p></header>
      <dl className="review-evidence-meta"><div><dt>Recorded by / owner</dt><dd>{record.owner}</dd></div><div><dt>Recorded position</dt><dd>{record.status}</dd></div><div><dt>As of</dt><dd>{formatDate(record.recordedAt, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dubai' })}</dd></div></dl>
      <section><h2>Purpose and scope</h2><p>{record.purpose}</p></section>
      {record.criteria.length > 0 && <section><h2>Review criteria</h2><ul>{record.criteria.map((value, index) => <li key={index}>{value}</li>)}</ul></section>}
      <section><h2>Recorded observations</h2>{record.observations.map((value, index) => <p key={index}>{value}</p>)}</section>
      <section className="review-evidence-next"><h2>Next action</h2><p>{record.nextAction}</p></section>
      <section><h2>Connected work</h2><ul>{record.relatedWork.map((value, index) => <li key={index}>{value}</li>)}</ul></section>
      <footer>This populated specimen illustrates the record that would support a real review. Its contents, checks and approvals are fictional. Opening it does not approve an artifact, pass a check or change the work.</footer>
    </article>}
  </main>;
}
