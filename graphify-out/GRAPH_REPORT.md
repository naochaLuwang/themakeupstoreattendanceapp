# Graph Report - .  (2026-11-26)

## Corpus Check
- 157 files · ~54,361 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 603 nodes · 1555 edges · 35 communities (34 shown, 1 thin omitted)
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
- [[_COMMUNITY_Detail Actions and Transport|Detail Actions and Transport]]
- [[_COMMUNITY_Shelf Search and Filters|Shelf Search and Filters]]
- [[_COMMUNITY_Task Completion and Attachments|Task Completion and Attachments]]
- [[_COMMUNITY_Task Assignment and Lists|Task Assignment and Lists]]
- [[_COMMUNITY_Audit Execution and Templates|Audit Execution and Templates]]
- [[_COMMUNITY_Push Notification Infrastructure|Push Notification Infrastructure]]
- [[_COMMUNITY_Operations Navigation|Operations Navigation]]
- [[_COMMUNITY_Operations Routes and Access|Operations Routes and Access]]
- [[_COMMUNITY_Audit Queries and Routes|Audit Queries and Routes]]
- [[_COMMUNITY_Tester Navigation|Tester Navigation]]
- [[_COMMUNITY_Restock Navigation|Restock Navigation]]
- [[_COMMUNITY_Incident Navigation|Incident Navigation]]
- [[_COMMUNITY_Shelf Inspection Navigation|Shelf Inspection Navigation]]
- [[_COMMUNITY_Tester Lists and Store Selection|Tester Lists and Store Selection]]
- [[_COMMUNITY_Task Priority Cards|Task Priority Cards]]
- [[_COMMUNITY_Checklist and Damage Presentation|Checklist and Damage Presentation]]
- [[_COMMUNITY_Audit Lists and Cards|Audit Lists and Cards]]
- [[_COMMUNITY_Tester Status Cards|Tester Status Cards]]
- [[_COMMUNITY_Restock Lists and Cards|Restock Lists and Cards]]
- [[_COMMUNITY_Incident Lists and Filters|Incident Lists and Filters]]
- [[_COMMUNITY_Shared Operations Types|Shared Operations Types]]
- [[_COMMUNITY_Server Form Validation|Server Form Validation]]

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
10. `runOperation()` - 13 edges

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

## Communities (35 total, 1 thin omitted)

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
Cohesion: 0.21
Nodes (10): uploadIncidentImage(), createAuditTemplate(), ChecklistTemplateForm(), AuditForm(), TesterForm(), IncidentFormProps, typeLabels, IncidentForm() (+2 more)

### Community 5 - "Restock Approval Workflow"
Cohesion: 0.13
Nodes (18): itemsSchema, save(), createRestockRequest(), updateRestockRequest(), transition(), approveRestockRequest(), rejectRestockRequest(), completeRestockRequest() (+10 more)

### Community 4 - "Management Permissions and Creation"
Cohesion: 0.11
Nodes (21): createTester(), updateTester(), markNeedsReplacement(), updateTesterCondition(), createTask(), TasksPage(), NewTaskPage(), NewTesterPage() (+13 more)

### Community 3 - "Detail Actions and Transport"
Cohesion: 0.12
Nodes (16): deleteTester(), logTesterAction(), approveShelfInspection(), addInspectionComment(), TaskDetail(), TesterDetailProps, conditionStyles, TesterDetail() (+8 more)

### Community 27 - "Shelf Search and Filters"
Cohesion: 0.29
Nodes (5): getShelfInspectionPage(), ShelfInspectionListProps, statusStyles, statusLabels, INSPECTION_STATUSES

### Community 9 - "Task Completion and Attachments"
Cohesion: 0.15
Nodes (13): deleteTask(), completeTask(), cancelTask(), addTaskComment(), uploadTaskAttachment(), deleteTaskAttachment(), saveTaskAttachment(), TaskDetailProps (+5 more)

### Community 12 - "Task Assignment and Lists"
Cohesion: 0.17
Nodes (10): updateTask(), getEmployees(), TaskListProps, statusStyles, priorityTableStyles, TaskFormProps, TaskForm(), TASK_PRIORITIES (+2 more)

### Community 6 - "Audit Execution and Templates"
Cohesion: 0.14
Nodes (15): deleteAuditTemplate(), startAudit(), submitAuditAnswer(), completeAudit(), uploadAuditImage(), deleteAudit(), TemplatesSectionProps, AuditDetailViewProps (+7 more)

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

### Community 28 - "Tester Lists and Store Selection"
Cohesion: 0.28
Nodes (4): TesterListProps, condStyles, TESTER_CONDITIONS, createClient()

### Community 29 - "Task Priority Cards"
Cohesion: 0.40
Nodes (3): TaskCardProps, priorityStyles, statusStyles

### Community 24 - "Checklist and Damage Presentation"
Cohesion: 0.22
Nodes (9): ChecklistTemplateFormProps, DamageReportListProps, statusStyles, DAMAGE_TYPES, DAMAGE_REPORT_STATUSES, CHECKLIST_TYPES, CHECKLIST_STATUSES, DEFAULT_OPENING_ITEMS (+1 more)

### Community 14 - "Audit Lists and Cards"
Cohesion: 0.20
Nodes (6): AuditCardProps, statusStyles, AuditListProps, statusStyles, AUDIT_CATEGORIES, AUDIT_STATUSES

### Community 16 - "Tester Status Cards"
Cohesion: 0.50
Nodes (4): TesterCardProps, expiryBadge(), conditionStyles, TesterCard()

### Community 21 - "Restock Lists and Cards"
Cohesion: 0.22
Nodes (5): RestockListProps, statusStyles, RestockCardProps, statusStyles, RESTOCK_STATUSES

### Community 11 - "Incident Lists and Filters"
Cohesion: 0.29
Nodes (5): IncidentListProps, statusStyles, typeLabels, INCIDENT_PRIORITIES, INCIDENT_STATUSES

### Community 2 - "Shared Operations Types"
Cohesion: 0.07
Nodes (32): DamageReport, DamageImage, DamageComment, DamageReportFilters, TesterFilters, AuditFilters, TaskFilters, RestockFilters (+24 more)

### Community 15 - "Server Form Validation"
Cohesion: 0.33
Nodes (5): optionalText, imageUrls, damageSchema, taskSchema, testerSchema

## Knowledge Gaps
- **86 isolated node(s):** `Report`, `templateSchema`, `itemsSchema`, `StoreOpsNavProps`, `modules` (+81 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `operationsContext()` connect `Checklists and Shared Uploads` to `Detail Actions and Transport`, `Management Permissions and Creation`, `Restock Approval Workflow`, `Audit Execution and Templates`, `Reports and Exports`, `Form Draft Recovery`, `Incidents and Private Media`, `Damage Approval Workflow`, `Shelf Search and Filters`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Operations Routes and Access` to `Checklists and Shared Uploads`, `Push Notification Infrastructure`, `Shared Operations Types`, `Management Permissions and Creation`, `Audit Execution and Templates`, `Task Completion and Attachments`, `Incidents and Private Media`, `Tester Navigation`, `Shelf Inspection Navigation`, `Restock Navigation`, `Incident Navigation`, `Audit Queries and Routes`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **Why does `can()` connect `Management Permissions and Creation` to `Checklists and Shared Uploads`, `Task Completion and Attachments`, `Incidents and Private Media`, `Task Assignment and Lists`, `Tester Navigation`, `Shelf Inspection Navigation`, `Operations Routes and Access`, `Restock Navigation`, `Incident Navigation`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **What connects `Report`, `templateSchema`, `itemsSchema` to the rest of the system?**
  _86 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Incidents and Private Media` be split into smaller, more focused modules?**
  _Cohesion score 0.061979648473635525 - nodes in this community are weakly interconnected._
- **Should `Checklists and Shared Uploads` be split into smaller, more focused modules?**
  _Cohesion score 0.051201671891327065 - nodes in this community are weakly interconnected._
- **Should `Restock Approval Workflow` be split into smaller, more focused modules?**
  _Cohesion score 0.12615384615384614 - nodes in this community are weakly interconnected._