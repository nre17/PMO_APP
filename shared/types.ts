export type Role = 'pmo' | 'lead' | 'contributor' | 'executive' | 'admin';
export type Health = 'green' | 'amber' | 'red' | 'unknown';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export const LIFECYCLE_PHASES = ['shaping', 'discovery', 'design', 'build', 'assurance', 'release', 'adoption'] as const;
export type LifecyclePhase = typeof LIFECYCLE_PHASES[number];
export type WorkflowKind = 'software' | 'general';
export const SOFTWARE_STAGES = ['Backlog', 'Development', 'UAT', 'Ready for production', 'Production verification', 'Awaiting client acceptance', 'Closed'] as const;
export const GENERAL_STAGES = ['Backlog', 'In progress', 'Review', 'Closed'] as const;
export type Stage = typeof SOFTWARE_STAGES[number] | typeof GENERAL_STAGES[number];
export interface Versioned { id: string; version: number; updatedAt: string }
export interface Member { id: string; name: string; initials: string; role: Role; title: string; color: string; workstreamIds: string[]; canApproveReports: boolean }
export interface Settings { version?: number; projectName: string; phaseName: string; timezone: string; submissionHour: number; cutoffHour: number; blockedEscalationDays: number; workingDays: number[] }
export interface SourceReference { documentId: string; locator: string; fileHash?: string }
export interface Workstream extends Versioned { name: string; shortName: string; description: string; leadId: string; health: Health; statusNote: string; clientSummary: string; color: string; lifecyclePhase?: LifecyclePhase; priority?: Priority; scope?: string; nextGate?: string; gateDate?: string; group?: string; groups?: string[]; phaseLabel?: string; sources?: SourceReference[] }
export interface Deliverable extends Versioned { title: string; workstreamId: string; ownerId: string; description: string; lifecyclePhase?: LifecyclePhase; status?: 'planned' | 'draft' | 'in_review' | 'accepted'; evidenceLinks?: string[] }
export interface Milestone extends Versioned { title: string; workstreamIds: string[]; deliverableIds: string[]; ownerId: string; baselineDate: string; forecastDate: string; actualDate?: string; status: 'planned' | 'at_risk' | 'complete'; notes: string }
export interface WorkItem extends Versioned {
  title: string; description: string; workstreamId: string; deliverableId?: string;
  kind: WorkflowKind; category: 'feature' | 'bug' | 'data' | 'evaluation' | 'action' | 'research';
  stage: Stage; priority: Priority | 'Not set'; ownerId: string; currentOwnerId: string;
  baselineDate: string; dueDate: string; acceptanceCriteria: string;
  evidenceLinks: string[]; blocked: boolean; blockReason: string; blockedSince?: string;
  nextAction: string; clientSummary: string; clientVisible: boolean;
  cycle: number; createdAt: string; closedAt?: string; tags: string[];
  importedFrom?: string;
}
export interface TestResult { id: string; itemId: string; cycle: number; stage: Stage; result: 'pass' | 'fail'; blocking: boolean; notes: string; evidence: string; authorId: string; createdAt: string; resolvedAt?: string; resolvedBy?: string; resolution?: string }
export type RegisterType = 'risk' | 'assumption' | 'issue' | 'dependency' | 'decision';
export interface Register extends Versioned { type: RegisterType; title: string; detail: string; clientSummary: string; clientVisible: boolean; workstreamId: string; relatedItemIds: string[]; milestoneIds: string[]; ownerId: string; dueDate: string; priority: Priority; probability: 'Low' | 'Medium' | 'High'; status: 'open' | 'monitoring' | 'escalated' | 'resolved'; mitigation: string; nextAction: string; impact: string }
export interface Meeting extends Versioned { title: string; heldAt: string; notes: string; linkedItemIds: string[]; linkedRegisterIds: string[] }
export interface Submission extends Versioned { workstreamId: string; periodEnd: string; completed: string; next: string; changes: string; blockers: string; health: Health; confirmedBy: string; confirmedAt: string; sourceUpdatedAt: string }
export interface BriefWorkstream { name: string; health: Health; completed: string[]; next: string[]; attention: string[]; confirmed: boolean }
export interface ReportBody { summary: string; highlights: string[]; nextWeek: string[]; attention: string[]; workstreams: BriefWorkstream[]; milestones: { title: string; forecastDate: string; status: string }[] }
export interface Report extends Versioned { title: string; audience: 'internal' | 'client'; periodStart: string; periodEnd: string; asOf: string; status: 'draft' | 'approved'; body: ReportBody; sourceVersions: Record<string, number>; createdBy: string; createdAt: string; approvedBy?: string; approvedAt?: string; incompleteReason?: string; supersedesId?: string }
export interface AuditEvent { id: string; entityType: string; entityId: string; actorId: string; action: string; detail: string; createdAt: string; before?: unknown; after?: unknown }
export interface SourceDocument extends Versioned { name: string; kind: 'tracker' | 'steerco' | 'briefing' | 'unavailable'; coverage: 'current' | 'context' | 'unavailable'; sourceDate?: string; receivedAt: string; fileHash?: string; summary: string; warnings: string[] }
export interface SourceRecord extends Versioned {
  documentId: string; sourceKey: string; locator: string; workstreamId: string;
  title: string; detail: string; sourceStatus: string; sourceOwner: string; sourcePriority: string; sourceDates: string;
  resolutionNotes: string; disposition: 'active' | 'completed' | 'needs_review' | 'excluded';
  mappingNote: string; fileHash?: string; itemId?: string; syncNote?: string;
}
export interface HubState { settings: Settings; members: Member[]; workstreams: Workstream[]; deliverables: Deliverable[]; milestones: Milestone[]; items: WorkItem[]; tests: TestResult[]; registers: Register[]; meetings: Meeting[]; submissions: Submission[]; reports: Report[]; events: AuditEvent[]; sourceDocuments?: SourceDocument[]; sourceRecords?: SourceRecord[] }
export interface Bootstrap { state: HubState; currentUserId: string; aiAvailable: boolean; demoMode: boolean; now: string }
export interface ImportRow { line: number; item: Partial<WorkItem>; errors: string[]; duplicate: boolean }
export interface ImportPreview { id: string; headers: string[]; mapping: Record<string, string>; rows: ImportRow[]; validCount: number; invalidCount: number; duplicateCount: number }
export interface AIProposal { type: 'action' | 'issue' | 'decision'; title: string; detail: string; ownerId: string | null; dueDate: string | null; sourceQuote: string; workstreamId?: string }
export type Mutate = (path: string, body?: unknown, method?: string) => Promise<any>;
export interface PageProps { state: HubState; user: Member; mutate: Mutate; notify: (message: string, error?: boolean) => void; openItem: (id: string) => void; aiAvailable: boolean }
