# Graph Report - attendance-app  (2026-11-27)

## Corpus Check
- 163 files · ~55,819 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 627 nodes · 1607 edges · 37 communities (34 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `50e95f5b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Checklists and Shared Uploads|Checklists and Shared Uploads]]
- [[_COMMUNITY_Push Notification Infrastructure|Push Notification Infrastructure]]
- [[_COMMUNITY_Shared Operations Types|Shared Operations Types]]
- [[_COMMUNITY_Detail Actions and Transport|Detail Actions and Transport]]
- [[_COMMUNITY_Management Permissions and Creation|Management Permissions and Creation]]
- [[_COMMUNITY_Restock Approval Workflow|Restock Approval Workflow]]
- [[_COMMUNITY_Audit Execution and Templates|Audit Execution and Templates]]
- [[_COMMUNITY_Reports and Exports|Reports and Exports]]
- [[_COMMUNITY_Form Draft Recovery|Form Draft Recovery]]
- [[_COMMUNITY_Task Completion and Attachments|Task Completion and Attachments]]
- [[_COMMUNITY_Incidents and Private Media|Incidents and Private Media]]
- [[_COMMUNITY_Incident Lists and Filters|Incident Lists and Filters]]
- [[_COMMUNITY_Task Assignment and Lists|Task Assignment and Lists]]
- [[_COMMUNITY_Tester Navigation|Tester Navigation]]
- [[_COMMUNITY_Audit Lists and Cards|Audit Lists and Cards]]
- [[_COMMUNITY_Server Form Validation|Server Form Validation]]
- [[_COMMUNITY_Tester Status Cards|Tester Status Cards]]
- [[_COMMUNITY_Shelf Inspection Navigation|Shelf Inspection Navigation]]
- [[_COMMUNITY_Operations Routes and Access|Operations Routes and Access]]
- [[_COMMUNITY_Restock Navigation|Restock Navigation]]
- [[_COMMUNITY_Incident Navigation|Incident Navigation]]
- [[_COMMUNITY_Restock Lists and Cards|Restock Lists and Cards]]
- [[_COMMUNITY_Damage Approval Workflow|Damage Approval Workflow]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Checklist and Damage Presentation|Checklist and Damage Presentation]]
- [[_COMMUNITY_Audit Queries and Routes|Audit Queries and Routes]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Task Priority Cards|Task Priority Cards]]
- [[_COMMUNITY_Operations Navigation|Operations Navigation]]

## God Nodes (most connected - your core abstractions)
1. `operationsContext()` - 75 edges
2. `can()` - 67 edges
3. `createClient()` - 56 edges
4. `operationError()` - 48 edges
5. `removeOperationsImages()` - 20 edges
6. `createClient()` - 20 edges
7. `uploadOperationsImage()` - 16 edges
8. `useOperationsDraft()` - 15 edges
9. `canDelete()` - 15 edges
10. `runOperation()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `updateTesterCondition()` --calls--> `can()`  [EXTRACTED]
  app/actions/store-ops/testers.ts → lib/store-ops/permissions.ts
- `TasksPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/tasks/page.tsx → lib/store-ops/permissions.ts
- `TestersPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/testers/page.tsx → lib/store-ops/permissions.ts
- `TesterDetailPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/testers/[id]/page.tsx → lib/store-ops/permissions.ts
- `RestockingPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/restocking/page.tsx → lib/store-ops/permissions.ts

## Communities (37 total, 3 thin omitted)

### Community 0 - "Checklists and Shared Uploads"
Cohesion: 0.13
Nodes (17): EditDamage(), EditIncident(), EditInspection(), EditRestock(), EditTask(), GET(), Notifications(), OperationsSettings() (+9 more)

### Community 1 - "Push Notification Infrastructure"
Cohesion: 0.07
Nodes (48): createServiceClient(), getAdminClient(), notificationProviders(), headers, notificationRequest(), notificationPath(), createNotificationDispatcher(), Delivery (+40 more)

### Community 2 - "Shared Operations Types"
Cohesion: 0.06
Nodes (35): DamageReportDetailProps, statusStyles, addDamageComment(), Audit, AuditAnswer, AuditQuestion, AuditTemplate, Incident (+27 more)

### Community 3 - "Detail Actions and Transport"
Cohesion: 0.07
Nodes (28): DamageReportDetail(), IncidentDetail(), RestockDetail(), ShelfInspectionDetail(), ShelfInspectionDetailProps, statusStyles, canDelete(), canManageApprovals() (+20 more)

### Community 4 - "Management Permissions and Creation"
Cohesion: 0.13
Nodes (16): DamageReportsPage(), EmployeeDamageReportsPage(), EditTesterPage(), EmployeeNewDamageReportPage(), EmployeeNewIncidentPage(), EmployeeNewRestockRequestPage(), EmployeeNewShelfInspectionPage(), NewDamageReportPage() (+8 more)

### Community 5 - "Restock Approval Workflow"
Cohesion: 0.13
Nodes (18): RestockDetailProps, statusStyles, RestockForm(), RestockItemForm, cameraError(), CameraSession, requestCamera(), startAttendanceCamera() (+10 more)

### Community 6 - "Audit Execution and Templates"
Cohesion: 0.13
Nodes (18): enableNativeNotifications(), postNotification(), enableEmployeePush(), loadNotificationFeed(), NotificationItem, NotificationScope, NotificationSnapshot, Feed (+10 more)

### Community 7 - "Reports and Exports"
Cohesion: 0.16
Nodes (11): Reports(), getDamageReturnList(), csvText(), downloadCsv(), ExportCell, Charts, metricLabels, OperationsReport (+3 more)

### Community 8 - "Form Draft Recovery"
Cohesion: 0.25
Nodes (8): AuditForm(), ChecklistTemplateForm(), ChecklistTemplateFormProps, DamageReportForm(), createAuditTemplate(), AUDIT_CATEGORIES, useOperationsDraft(), TesterForm()

### Community 9 - "Task Completion and Attachments"
Cohesion: 0.18
Nodes (15): DamageReportFormProps, approveDamageReport(), archiveDamageReport(), createDamageReport(), rejectDamageReport(), Report, review(), saveReport() (+7 more)

### Community 10 - "Incidents and Private Media"
Cohesion: 0.06
Nodes (28): DamageReportCardProps, statusStyles, IncidentCardProps, priorityStyles, statusStyles, typeLabels, IncidentDetailProps, statusStyles (+20 more)

### Community 11 - "Incident Lists and Filters"
Cohesion: 0.18
Nodes (9): IncidentForm(), IncidentFormProps, typeLabels, IncidentListProps, statusStyles, typeLabels, INCIDENT_PRIORITIES, INCIDENT_STATUSES (+1 more)

### Community 12 - "Task Assignment and Lists"
Cohesion: 0.15
Nodes (11): TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES, createTask(), getEmployees(), updateTask(), TaskForm(), TaskFormProps (+3 more)

### Community 13 - "Tester Navigation"
Cohesion: 0.22
Nodes (4): TesterDetailPage(), TesterWithRelations, EmployeeTestersPage(), TestersPage()

### Community 14 - "Audit Lists and Cards"
Cohesion: 0.25
Nodes (4): AuditCardProps, statusStyles, statusStyles, AUDIT_STATUSES

### Community 15 - "Server Form Validation"
Cohesion: 0.22
Nodes (8): DamageReportListProps, statusStyles, CHECKLIST_STATUSES, CHECKLIST_TYPES, DAMAGE_REPORT_STATUSES, DAMAGE_TYPES, DEFAULT_CLOSING_ITEMS, DEFAULT_OPENING_ITEMS

### Community 16 - "Tester Status Cards"
Cohesion: 0.50
Nodes (4): conditionStyles, expiryBadge(), TesterCard(), TesterCardProps

### Community 17 - "Shelf Inspection Navigation"
Cohesion: 0.22
Nodes (3): EmployeeShelfInspectionsPage(), ShelfInspectionsPage(), ShelfInspectionWithRelations

### Community 18 - "Operations Routes and Access"
Cohesion: 0.11
Nodes (5): SmartScanBranchSettings, SmartScanSettingsCommand, TaskWithRelations, createClient(), TasksPage()

### Community 19 - "Restock Navigation"
Cohesion: 0.18
Nodes (6): EmployeeRestockingPage(), RestockingPage(), RestockListProps, statusStyles, RESTOCK_STATUSES, RestockRequestWithRelations

### Community 20 - "Incident Navigation"
Cohesion: 0.22
Nodes (3): EmployeeIncidentsPage(), IncidentsPage(), IncidentWithRelations

### Community 22 - "Damage Approval Workflow"
Cohesion: 0.14
Nodes (16): HistoryItem, Checklist, ChecklistItem, Template, completeChecklistItem(), completeDailyChecklist(), createTemplate(), getChecklistHistory() (+8 more)

### Community 23 - "Community 23"
Cohesion: 0.14
Nodes (13): Props, ShelfInspectionForm(), Values, saveOperationsSettings(), useFormDraft(), damageSchema, imageUrls, incidentSchema (+5 more)

### Community 24 - "Checklist and Damage Presentation"
Cohesion: 0.27
Nodes (4): TESTER_CONDITIONS, createClient(), condStyles, TesterListProps

### Community 25 - "Audit Queries and Routes"
Cohesion: 0.09
Nodes (21): AuditListProps, AuditRunnerProps, AuditsPage(), TemplatesSectionProps, TemplateListProps, AuditDetailViewProps, AuditDetailPage(), Props (+13 more)

### Community 26 - "Community 26"
Cohesion: 0.26
Nodes (12): operationError(), addInspectionComment(), approveShelfInspection(), createShelfInspection(), createStoreSection(), deleteStoreSection(), getShelfInspectionPage(), getStoreSections() (+4 more)

### Community 27 - "Community 27"
Cohesion: 0.36
Nodes (4): encode(), prepareImage(), ImageUploadProps, removeDraftImage()

### Community 29 - "Task Priority Cards"
Cohesion: 0.40
Nodes (3): priorityStyles, statusStyles, TaskCardProps

## Knowledge Gaps
- **93 isolated node(s):** `Report`, `templateSchema`, `itemsSchema`, `StoreOpsNavProps`, `modules` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `operationsContext()` connect `Checklists and Shared Uploads` to `Shared Operations Types`, `Management Permissions and Creation`, `Restock Approval Workflow`, `Audit Execution and Templates`, `Reports and Exports`, `Form Draft Recovery`, `Task Completion and Attachments`, `Incidents and Private Media`, `Damage Approval Workflow`, `Community 23`, `Audit Queries and Routes`, `Community 26`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Operations Routes and Access` to `Checklists and Shared Uploads`, `Push Notification Infrastructure`, `Shared Operations Types`, `Detail Actions and Transport`, `Management Permissions and Creation`, `Incidents and Private Media`, `Tester Navigation`, `Shelf Inspection Navigation`, `Restock Navigation`, `Incident Navigation`, `Audit Queries and Routes`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `can()` connect `Management Permissions and Creation` to `Checklists and Shared Uploads`, `Detail Actions and Transport`, `Incidents and Private Media`, `Task Assignment and Lists`, `Tester Navigation`, `Shelf Inspection Navigation`, `Operations Routes and Access`, `Restock Navigation`, `Incident Navigation`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **What connects `Report`, `templateSchema`, `itemsSchema` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Checklists and Shared Uploads` be split into smaller, more focused modules?**
  _Cohesion score 0.1330049261083744 - nodes in this community are weakly interconnected._
- **Should `Push Notification Infrastructure` be split into smaller, more focused modules?**
  _Cohesion score 0.073224043715847 - nodes in this community are weakly interconnected._
- **Should `Shared Operations Types` be split into smaller, more focused modules?**
  _Cohesion score 0.059506531204644414 - nodes in this community are weakly interconnected._