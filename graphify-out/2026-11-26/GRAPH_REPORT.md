# Graph Report - .  (2026-11-26)

## Corpus Check
- 157 files · ~54,285 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 603 nodes · 1551 edges · 32 communities (30 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e0e3f4aa`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Damage Approval Workflow|Damage Approval Workflow]]
- [[_COMMUNITY_Incidents and Private Media|Incidents and Private Media]]
- [[_COMMUNITY_Reports and Exports|Reports and Exports]]
- [[_COMMUNITY_Checklists and Shared Uploads|Checklists and Shared Uploads]]
- [[_COMMUNITY_Form Draft Recovery|Form Draft Recovery]]
- [[_COMMUNITY_Restock Approval Workflow|Restock Approval Workflow]]
- [[_COMMUNITY_Management Permissions and Creation|Management Permissions and Creation]]
- [[_COMMUNITY_Task and Detail Actions|Task and Detail Actions]]
- [[_COMMUNITY_Shelf Search and Validation|Shelf Search and Validation]]
- [[_COMMUNITY_Task Assignment and Lists|Task Assignment and Lists]]
- [[_COMMUNITY_Audit Workflow and Types|Audit Workflow and Types]]
- [[_COMMUNITY_Audit Creation and Selection|Audit Creation and Selection]]
- [[_COMMUNITY_Push Notification Infrastructure|Push Notification Infrastructure]]
- [[_COMMUNITY_Operations Navigation|Operations Navigation]]
- [[_COMMUNITY_Operations Routes and Access|Operations Routes and Access]]
- [[_COMMUNITY_Audit Queries and Routes|Audit Queries and Routes]]
- [[_COMMUNITY_Tester Navigation|Tester Navigation]]
- [[_COMMUNITY_Restock Navigation|Restock Navigation]]
- [[_COMMUNITY_Incident Navigation|Incident Navigation]]
- [[_COMMUNITY_Shelf Inspection Navigation|Shelf Inspection Navigation]]
- [[_COMMUNITY_Task Priority Cards|Task Priority Cards]]
- [[_COMMUNITY_Checklist and Damage Presentation|Checklist and Damage Presentation]]
- [[_COMMUNITY_Audit Summary Cards|Audit Summary Cards]]
- [[_COMMUNITY_Tester Status Presentation|Tester Status Presentation]]
- [[_COMMUNITY_Restock Lists and Cards|Restock Lists and Cards]]
- [[_COMMUNITY_Incident Lists and Filters|Incident Lists and Filters]]

## God Nodes (most connected - your core abstractions)
1. `operationsContext()` - 74 edges
2. `can()` - 67 edges
3. `createClient()` - 55 edges
4. `operationError()` - 47 edges
5. `removeOperationsImages()` - 20 edges
6. `createClient()` - 19 edges
7. `uploadOperationsImage()` - 16 edges
8. `useOperationsDraft()` - 15 edges
9. `canDelete()` - 15 edges
10. `canManageApprovals()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `TestersPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/testers/page.tsx → lib/store-ops/permissions.ts
- `TesterDetailPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/testers/[id]/page.tsx → lib/store-ops/permissions.ts
- `RestockingPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/restocking/page.tsx → lib/store-ops/permissions.ts
- `DamageReportsPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/damage-reports/page.tsx → lib/store-ops/permissions.ts
- `IncidentsPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/incidents/page.tsx → lib/store-ops/permissions.ts

## Communities (32 total, 2 thin omitted)

### Community 22 - "Damage Approval Workflow"
Cohesion: 0.16
Nodes (15): Report, saveReport(), createDamageReport(), updateDamageReport(), review(), approveDamageReport(), rejectDamageReport(), archiveDamageReport() (+7 more)

### Community 10 - "Incidents and Private Media"
Cohesion: 0.06
Nodes (30): deleteDamageReport(), uploadIncidentVoice(), saveIncident(), createIncident(), updateIncident(), deleteIncident(), updateIncidentStatus(), assignIncident() (+22 more)

### Community 7 - "Reports and Exports"
Cohesion: 0.16
Nodes (11): getDamageReturnList(), Reports(), Charts, getOperationsReport(), reportSchema, OperationsReport, metricLabels, reportRange() (+3 more)

### Community 0 - "Checklists and Shared Uploads"
Cohesion: 0.05
Nodes (54): templateSchema, saveTemplate(), createTemplate(), updateTemplate(), deleteTemplate(), startDailyChecklist(), completeChecklistItem(), uploadChecklistPhoto() (+46 more)

### Community 8 - "Form Draft Recovery"
Cohesion: 0.22
Nodes (9): uploadIncidentImage(), TaskForm(), ChecklistTemplateForm(), TesterForm(), IncidentFormProps, typeLabels, IncidentForm(), useOperationsDraft() (+1 more)

### Community 5 - "Restock Approval Workflow"
Cohesion: 0.13
Nodes (18): itemsSchema, save(), createRestockRequest(), updateRestockRequest(), transition(), approveRestockRequest(), rejectRestockRequest(), completeRestockRequest() (+10 more)

### Community 4 - "Management Permissions and Creation"
Cohesion: 0.11
Nodes (21): createTester(), updateTester(), markNeedsReplacement(), updateTesterCondition(), createTask(), TasksPage(), NewTaskPage(), NewTesterPage() (+13 more)

### Community 3 - "Task and Detail Actions"
Cohesion: 0.07
Nodes (30): deleteTester(), logTesterAction(), approveShelfInspection(), addInspectionComment(), deleteTask(), completeTask(), cancelTask(), addTaskComment() (+22 more)

### Community 27 - "Shelf Search and Validation"
Cohesion: 0.15
Nodes (10): getShelfInspectionPage(), ShelfInspectionListProps, statusStyles, statusLabels, optionalText, imageUrls, damageSchema, taskSchema (+2 more)

### Community 12 - "Task Assignment and Lists"
Cohesion: 0.18
Nodes (9): updateTask(), getEmployees(), TaskListProps, statusStyles, priorityTableStyles, TaskFormProps, TASK_PRIORITIES, TASK_STATUSES (+1 more)

### Community 2 - "Audit Workflow and Types"
Cohesion: 0.05
Nodes (46): deleteAuditTemplate(), startAudit(), submitAuditAnswer(), completeAudit(), uploadAuditImage(), deleteAudit(), TemplatesSectionProps, AuditDetailViewProps (+38 more)

### Community 14 - "Audit Creation and Selection"
Cohesion: 0.20
Nodes (7): createAuditTemplate(), AuditForm(), AuditListProps, statusStyles, AUDIT_CATEGORIES, AUDIT_STATUSES, createClient()

### Community 1 - "Push Notification Infrastructure"
Cohesion: 0.07
Nodes (48): POST(), createServiceClient(), getAdminClient(), runOperationsWorker(), Json, notificationObject(), boolean(), integer() (+40 more)

### Community 18 - "Operations Routes and Access"
Cohesion: 0.10
Nodes (5): DamageReportsPage(), NewIncidentPage(), EmployeeDamageReportsPage(), DamageReportWithRelations, createClient()

### Community 25 - "Audit Queries and Routes"
Cohesion: 0.60
Nodes (3): AuditsPage(), getAuditTemplates(), getAudits()

### Community 13 - "Tester Navigation"
Cohesion: 0.22
Nodes (4): TestersPage(), TesterDetailPage(), EmployeeTestersPage(), TesterWithRelations

### Community 19 - "Restock Navigation"
Cohesion: 0.22
Nodes (3): RestockingPage(), EmployeeRestockingPage(), RestockRequestWithRelations

### Community 20 - "Incident Navigation"
Cohesion: 0.22
Nodes (3): IncidentsPage(), EmployeeIncidentsPage(), IncidentWithRelations

### Community 17 - "Shelf Inspection Navigation"
Cohesion: 0.22
Nodes (3): ShelfInspectionsPage(), EmployeeShelfInspectionsPage(), ShelfInspectionWithRelations

### Community 29 - "Task Priority Cards"
Cohesion: 0.40
Nodes (3): TaskCardProps, priorityStyles, statusStyles

### Community 24 - "Checklist and Damage Presentation"
Cohesion: 0.22
Nodes (9): ChecklistTemplateFormProps, DamageReportListProps, statusStyles, DAMAGE_TYPES, DAMAGE_REPORT_STATUSES, CHECKLIST_TYPES, CHECKLIST_STATUSES, DEFAULT_OPENING_ITEMS (+1 more)

### Community 28 - "Tester Status Presentation"
Cohesion: 0.22
Nodes (7): TesterListProps, condStyles, TesterCardProps, expiryBadge(), conditionStyles, TesterCard(), TESTER_CONDITIONS

### Community 21 - "Restock Lists and Cards"
Cohesion: 0.22
Nodes (5): RestockListProps, statusStyles, RestockCardProps, statusStyles, RESTOCK_STATUSES

### Community 11 - "Incident Lists and Filters"
Cohesion: 0.29
Nodes (5): IncidentListProps, statusStyles, typeLabels, INCIDENT_PRIORITIES, INCIDENT_STATUSES

## Knowledge Gaps
- **86 isolated node(s):** `Report`, `templateSchema`, `itemsSchema`, `StoreOpsNavProps`, `modules` (+81 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `operationsContext()` connect `Checklists and Shared Uploads` to `Audit Workflow and Types`, `Task and Detail Actions`, `Management Permissions and Creation`, `Restock Approval Workflow`, `Reports and Exports`, `Incidents and Private Media`, `Audit Creation and Selection`, `Damage Approval Workflow`, `Shelf Search and Validation`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Operations Routes and Access` to `Checklists and Shared Uploads`, `Push Notification Infrastructure`, `Audit Workflow and Types`, `Task and Detail Actions`, `Management Permissions and Creation`, `Incidents and Private Media`, `Tester Navigation`, `Shelf Inspection Navigation`, `Restock Navigation`, `Incident Navigation`, `Audit Queries and Routes`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `can()` connect `Management Permissions and Creation` to `Checklists and Shared Uploads`, `Task and Detail Actions`, `Incidents and Private Media`, `Task Assignment and Lists`, `Tester Navigation`, `Shelf Inspection Navigation`, `Operations Routes and Access`, `Restock Navigation`, `Incident Navigation`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **What connects `Report`, `templateSchema`, `itemsSchema` to the rest of the system?**
  _86 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Incidents and Private Media` be split into smaller, more focused modules?**
  _Cohesion score 0.061979648473635525 - nodes in this community are weakly interconnected._
- **Should `Checklists and Shared Uploads` be split into smaller, more focused modules?**
  _Cohesion score 0.051201671891327065 - nodes in this community are weakly interconnected._
- **Should `Restock Approval Workflow` be split into smaller, more focused modules?**
  _Cohesion score 0.12615384615384614 - nodes in this community are weakly interconnected._