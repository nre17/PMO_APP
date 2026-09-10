export type WorkView = 'all' | 'attention' | 'mine' | 'milestones' | 'artifacts';
export type WorkspacePage = 'overview' | 'work' | 'registers' | 'reports' | 'sources';
export interface WorkspaceRoute { page: WorkspacePage; workView: WorkView; reportView: 'current' | 'archive' }
export const WORK_VIEWS: { id: WorkView; label: string }[] = [
  { id: 'all', label: 'All work' }, { id: 'attention', label: 'Needs attention' },
  { id: 'mine', label: 'My work' }, { id: 'milestones', label: 'Milestones' }, { id: 'artifacts', label: 'Artifacts' },
];

/** Old links stay useful; the sidebar represents destinations, not individual views. */
export function resolveWorkspaceRoute(hash: string): WorkspaceRoute {
  const [name, query = ''] = hash.replace(/^#/, '').split('?');
  const route: WorkspaceRoute = { page: 'overview', workView: 'all', reportView: 'current' };
  const oldWorkViews: Record<string, WorkView> = { delivery: 'all', operations: 'attention', 'my-actions': 'mine', milestones: 'milestones' };
  if (Object.hasOwn(oldWorkViews, name)) return { ...route, page: 'work', workView: oldWorkViews[name] };
  if (name === 'approved-briefs') return { ...route, page: 'reports', reportView: 'archive' };
  const view = new URLSearchParams(query).get('view');
  if (name === 'work') return { ...route, page: 'work', workView: WORK_VIEWS.some(option => option.id === view) ? view as WorkView : 'all' };
  if (name === 'reports') return { ...route, page: 'reports', reportView: view === 'archive' ? 'archive' : 'current' };
  if (name === 'registers' || name === 'sources') return { ...route, page: name };
  return route;
}

export function workspaceHash(route: WorkspaceRoute): string {
  if (route.page === 'work') return '#work' + (route.workView === 'all' ? '' : `?view=${route.workView}`);
  if (route.page === 'reports') return '#reports' + (route.reportView === 'archive' ? '?view=archive' : '');
  return '#' + route.page;
}
