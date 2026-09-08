import type { HubState } from '../shared/types.js';

// Confirmed names only. Lifecycle, outcomes, ownership and delivery evidence
// are deliberately empty until someone records the actual portfolio details.
export const PORTFOLIO_USE_CASES = [
  ['uc-performance-portfolio-intelligence', 'Performance Portfolio Intelligence', 'Performance intelligence'],
  ['uc-investment-companion', 'Investment Companion', 'Investment Companion'],
  ['uc-legal-companion', 'Legal Companion', 'Legal Companion'],
  ['uc-market-intelligence', 'Market Intelligence', 'Market Intelligence'],
  ['uc-accounting-validation', 'Accounting Validation', 'Accounting Validation'],
  ['uc-benchmark', 'Benchmark', 'Benchmark'],
  ['uc-treasury-liquidity', 'AI Based Treasury Liquidity Management', 'Treasury Liquidity'],
  ['uc-spreadsheet-intelligence', 'Spreadsheet Intelligence', 'Spreadsheet Intelligence'],
  ['uc-public-finance', 'Public Finance', 'Public Finance'],
  ['uc-budget-companion', 'Budget Companion', 'Budget Companion'],
] as const;

export function createPortfolioState(now = new Date()): HubState {
  const updatedAt = now.toISOString();
  const workstreamIds = PORTFOLIO_USE_CASES.map(([id]) => id);
  return {
    settings: { version: 1, projectName: 'AI use case portfolio', phaseName: 'Phase 2', timezone: 'Asia/Dubai', submissionHour: 10, cutoffHour: 12, blockedEscalationDays: 2, workingDays: [1, 2, 3, 4, 5] },
    members: [
      { id: 'preview-pmo', name: 'PMO preview', initials: 'PM', role: 'pmo', title: 'Local preview role', color: '#8600d6', workstreamIds: [], canApproveReports: false },
      { id: 'preview-approver', name: 'Approver preview', initials: 'AP', role: 'executive', title: 'Local preview role', color: '#8600d6', workstreamIds: [], canApproveReports: true },
      { id: 'preview-lead', name: 'Lead preview', initials: 'LP', role: 'lead', title: 'Local preview role', color: '#8600d6', workstreamIds: [...workstreamIds], canApproveReports: false },
      { id: 'preview-contributor', name: 'Contributor preview', initials: 'CP', role: 'contributor', title: 'Local preview role', color: '#8600d6', workstreamIds: [...workstreamIds], canApproveReports: false },
    ],
    workstreams: PORTFOLIO_USE_CASES.map(([id, name, shortName]) => ({ id, name, shortName, description: '', leadId: '', health: 'unknown', statusNote: '', clientSummary: '', color: '#8600d6', version: 1, updatedAt })),
    deliverables: [], milestones: [], items: [], tests: [], registers: [], meetings: [], submissions: [], reports: [], events: [],
  };
}
