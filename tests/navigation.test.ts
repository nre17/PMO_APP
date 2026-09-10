import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkspaceRoute, workspaceHash, WORK_VIEWS } from '../src/navigation.js';

test('legacy delivery, personal, milestone and archive links reach their consolidated destinations', () => {
  for (const [old, view] of [['delivery','all'],['operations','attention'],['my-actions','mine'],['milestones','milestones']]) {
    const route=resolveWorkspaceRoute('#'+old); assert.equal(route.page,'work'); assert.equal(route.workView,view);
  }
  assert.deepEqual(resolveWorkspaceRoute('#approved-briefs'), {page:'reports',workView:'all',reportView:'archive'});
});
test('work views and report history survive copying URLs into a fresh browser', () => {
  for (const {id} of WORK_VIEWS) {
    const route=resolveWorkspaceRoute('#work?view='+id);
    assert.equal(route.workView,id); assert.deepEqual(resolveWorkspaceRoute(workspaceHash(route)),route);
  }
  const archive=resolveWorkspaceRoute('#reports?view=archive');
  assert.deepEqual(resolveWorkspaceRoute(workspaceHash(archive)),archive);
  assert.equal(resolveWorkspaceRoute('#work?view=invalid').workView,'all');
  assert.equal(resolveWorkspaceRoute('#unknown').page,'overview');
});
