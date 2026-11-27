# Graph Report - attendance-app  (2026-11-27)

## Corpus Check
- 165 files · ~56,262 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 634 nodes · 1614 edges · 36 communities (34 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7034b5f2`
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
- `TasksPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/tasks/page.tsx → lib/store-ops/permissions.ts
- `TesterDetailPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/testers/[id]/page.tsx → lib/store-ops/permissions.ts
- `RestockingPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/restocking/page.tsx → lib/store-ops/permissions.ts
- `DamageReportsPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/damage-reports/page.tsx → lib/store-ops/permissions.ts
- `IncidentsPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/incidents/page.tsx → lib/store-ops/permissions.ts

## Communities (36 total, 2 thin omitted)

### Community 0 - "Checklists and Shared Uploads"
Cohesion: 0.05
Nodes (73): HistoryItem, Checklist, ChecklistItem, Template, EditDamage(), EditIncident(), EditInspection(), EditRestock() (+65 more)

### Community 1 - "Push Notification Infrastructure"
Cohesion: 0.07
Nodes (53): createServiceClient(), getAdminClient(), notificationProviders(), headers, notificationRequest(), notificationPath(), createNotificationDispatcher(), Delivery (+45 more)

### Community 2 - "Shared Operations Types"
Cohesion: 0.08
Nodes (30): TemplatesSectionProps, Audit, AuditAnswer, AuditQuestion, AuditTemplate, Incident, IncidentComment, IncidentImage (+22 more)

### Community 3 - "Detail Actions and Transport"
Cohesion: 0.08
Nodes (20): TesterDetailPage(), TemplateListProps, DamageReportDetail(), DamageReportDetailProps, statusStyles, IncidentDetail(), RestockDetail(), ShelfInspectionDetail() (+12 more)

### Community 4 - "Management Permissions and Creation"
Cohesion: 0.11
Nodes (22): EditTesterPage(), EmployeeNewDamageReportPage(), EmployeeNewIncidentPage(), EmployeeNewRestockRequestPage(), EmployeeNewShelfInspectionPage(), NewDamageReportPage(), NewIncidentPage(), NewRestockRequestPage() (+14 more)

### Community 5 - "Restock Approval Workflow"
Cohesion: 0.14
Nodes (16): RestockDetailProps, statusStyles, cameraError(), CameraSession, requestCamera(), startAttendanceCamera(), approveRestockRequest(), completeRestockRequest() (+8 more)

### Community 6 - "Audit Execution and Templates"
Cohesion: 0.12
Nodes (17): enableNativeNotifications(), postNotification(), enableEmployeePush(), loadNotificationFeed(), NotificationItem, NotificationScope, NotificationSnapshot, Feed (+9 more)

### Community 7 - "Reports and Exports"
Cohesion: 0.16
Nodes (11): Reports(), getDamageReturnList(), csvText(), downloadCsv(), ExportCell, Charts, metricLabels, OperationsReport (+3 more)

### Community 8 - "Form Draft Recovery"
Cohesion: 0.19
Nodes (11): AuditForm(), ChecklistTemplateForm(), DamageReportForm(), DamageReportFormProps, RestockForm(), RestockItemForm, DAMAGE_TYPES, TESTER_CONDITIONS (+3 more)

### Community 9 - "Task Completion and Attachments"
Cohesion: 0.17
Nodes (9): addTaskComment(), cancelTask(), completeTask(), deleteTask(), deleteTaskAttachment(), saveTaskAttachment(), priorityStyles, statusStyles (+1 more)

### Community 10 - "Incidents and Private Media"
Cohesion: 0.05
Nodes (38): DamageReportCardProps, statusStyles, IncidentCardProps, priorityStyles, statusStyles, typeLabels, IncidentDetailProps, statusStyles (+30 more)

### Community 11 - "Incident Lists and Filters"
Cohesion: 0.22
Nodes (3): DamageReportsPage(), EmployeeDamageReportsPage(), DamageReportWithRelations

### Community 12 - "Task Assignment and Lists"
Cohesion: 0.17
Nodes (10): TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES, getEmployees(), updateTask(), TaskForm(), TaskFormProps, priorityTableStyles (+2 more)

### Community 13 - "Tester Navigation"
Cohesion: 0.33
Nodes (3): metadata, EmployeeOperationPath, employeeOperationsModules

### Community 14 - "Audit Lists and Cards"
Cohesion: 0.22
Nodes (5): AuditCardProps, statusStyles, statusStyles, AUDIT_CATEGORIES, AUDIT_STATUSES

### Community 15 - "Server Form Validation"
Cohesion: 0.36
Nodes (6): ChecklistTemplateFormProps, CHECKLIST_STATUSES, CHECKLIST_TYPES, DEFAULT_CLOSING_ITEMS, DEFAULT_OPENING_ITEMS, createTemplate()

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
Cohesion: 0.22
Nodes (3): EmployeeRestockingPage(), RestockingPage(), RestockRequestWithRelations

### Community 20 - "Incident Navigation"
Cohesion: 0.22
Nodes (3): EmployeeIncidentsPage(), IncidentsPage(), IncidentWithRelations

### Community 21 - "Restock Lists and Cards"
Cohesion: 0.22
Nodes (5): RestockCardProps, statusStyles, RestockListProps, statusStyles, RESTOCK_STATUSES

### Community 22 - "Damage Approval Workflow"
Cohesion: 0.60
Nodes (3): AuditsPage(), getAudits(), getAuditTemplates()

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (4): ShelfInspectionListProps, statusLabels, statusStyles, INSPECTION_STATUSES

### Community 24 - "Checklist and Damage Presentation"
Cohesion: 0.31
Nodes (3): createClient(), condStyles, TesterListProps

### Community 25 - "Audit Queries and Routes"
Cohesion: 0.14
Nodes (11): AuditListProps, AuditRunnerProps, AuditDetailViewProps, AuditDetailPage(), Props, deleteAuditTemplate(), getAuditById(), encode() (+3 more)

### Community 26 - "Community 26"
Cohesion: 0.40
Nodes (3): DamageReportListProps, statusStyles, DAMAGE_REPORT_STATUSES

### Community 29 - "Task Priority Cards"
Cohesion: 0.40
Nodes (3): priorityStyles, statusStyles, TaskCardProps

## Knowledge Gaps
- **95 isolated node(s):** `Report`, `templateSchema`, `itemsSchema`, `StoreOpsNavProps`, `modules` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `operationsContext()` connect `Checklists and Shared Uploads` to `Management Permissions and Creation`, `Restock Approval Workflow`, `Audit Execution and Templates`, `Reports and Exports`, `Incidents and Private Media`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Operations Routes and Access` to `Checklists and Shared Uploads`, `Push Notification Infrastructure`, `Shared Operations Types`, `Detail Actions and Transport`, `Management Permissions and Creation`, `Audit Execution and Templates`, `Task Completion and Attachments`, `Incidents and Private Media`, `Incident Lists and Filters`, `Shelf Inspection Navigation`, `Restock Navigation`, `Incident Navigation`, `Damage Approval Workflow`, `Audit Queries and Routes`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `can()` connect `Management Permissions and Creation` to `Checklists and Shared Uploads`, `Detail Actions and Transport`, `Task Completion and Attachments`, `Incidents and Private Media`, `Incident Lists and Filters`, `Task Assignment and Lists`, `Shelf Inspection Navigation`, `Operations Routes and Access`, `Restock Navigation`, `Incident Navigation`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `Report`, `templateSchema`, `itemsSchema` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Checklists and Shared Uploads` be split into smaller, more focused modules?**
  _Cohesion score 0.051756785188302123 - nodes in this community are weakly interconnected._
- **Should `Push Notification Infrastructure` be split into smaller, more focused modules?**
  _Cohesion score 0.06584723441615452 - nodes in this community are weakly interconnected._
- **Should `Shared Operations Types` be split into smaller, more focused modules?**
  _Cohesion score 0.0782051282051282 - nodes in this community are weakly interconnected._