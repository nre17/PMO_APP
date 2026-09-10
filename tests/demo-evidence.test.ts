import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShowcaseState } from '../server/showcase-seed.js';
import { createPortfolioState } from '../server/portfolio-seed.js';
import { resolveDemoEvidence } from '../src/demo-evidence-model.js';

const now = new Date('2026-09-10T08:00:00.000Z');
const reference = (link: string) => decodeURIComponent(new URL(link).pathname.slice('/synthetic-demo/'.length));

test('prepared artifact and work references open their own context, not a generic success claim', () => {
  const state = createShowcaseState(now);
  for (const artifact of state.deliverables) for (const link of artifact.evidenceLinks || []) {
    const resolved = resolveDemoEvidence(state, reference(link));
    assert.equal(resolved?.title, artifact.title);
    assert.equal(resolved?.status, artifact.status?.replaceAll('_', ' '));
    assert.ok(resolved?.relatedWork.length);
  }
  for (const item of state.items) for (const link of item.evidenceLinks) {
    const resolved = resolveDemoEvidence(state, reference(link));
    assert.ok(resolved, `Missing prepared work reference: ${link}`);
    assert.ok(resolved.relatedWork.includes(item.title));
  }
});

test('a recorded check retains its result, author and original cycle in the evidence view', () => {
  const state = createShowcaseState(now);
  const failed = state.tests.find(result => result.result === 'fail')!;
  assert.ok(failed);
  const resolved = resolveDemoEvidence(state, reference(failed.evidence));
  assert.equal(resolved?.status, 'fail');
  assert.equal(resolved?.owner, state.members.find(member => member.id === failed.authorId)?.name);
  assert.ok(resolved?.observations.includes(`Recorded in delivery cycle ${failed.cycle}.`));
  assert.ok(resolved?.observations.includes(failed.notes));
});

test('unknown references and non-demonstration records do not invent evidence', () => {
  const state = createShowcaseState(now);
  assert.equal(resolveDemoEvidence(state, 'a-reference-that-does-not-exist'), undefined);
  assert.equal(resolveDemoEvidence(state, ''), undefined);
  const link = state.tests[0].evidence;
  const plain = { ...state, settings: createPortfolioState(now).settings };
  assert.equal(resolveDemoEvidence(plain, reference(link)), undefined);
  const wrongHost = structuredClone(state);
  wrongHost.tests[0].evidence = link.replace('example.invalid', 'unrelated.example');
  assert.notEqual(resolveDemoEvidence(wrongHost, reference(link))?.kind, 'Recorded check');
});
