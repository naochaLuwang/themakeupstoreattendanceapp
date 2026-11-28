# Graph Report - attendance-app  (2026-11-28)

## Corpus Check
- 179 files · ~59,712 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 674 nodes · 1671 edges · 37 communities (34 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fdd29205`
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
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Restock Lists and Cards|Restock Lists and Cards]]
- [[_COMMUNITY_Damage Approval Workflow|Damage Approval Workflow]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Checklist and Damage Presentation|Checklist and Damage Presentation]]
- [[_COMMUNITY_Audit Queries and Routes|Audit Queries and Routes]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Operations Navigation|Operations Navigation]]

## God Nodes (most connected - your core abstractions)
1. `operationsContext()` - 75 edges
2. `can()` - 67 edges
3. `createClient()` - 56 edges
4. `operationError()` - 48 edges
5. `removeOperationsImages()` - 20 edges
6. `createClient()` - 20 edges
7. `useOperationsDraft()` - 17 edges
8. `uploadOperationsImage()` - 16 edges
9. `canDelete()` - 15 edges
10. `runOperation()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `updateTesterCondition()` --calls--> `can()`  [EXTRACTED]
  app/actions/store-ops/testers.ts → lib/store-ops/permissions.ts
- `TestersPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/testers/page.tsx → lib/store-ops/permissions.ts
- `TesterDetailPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/testers/[id]/page.tsx → lib/store-ops/permissions.ts
- `RestockingPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/restocking/page.tsx → lib/store-ops/permissions.ts
- `DamageReportsPage()` --calls--> `can()`  [EXTRACTED]
  app/(dashboard)/admin/store-operations/damage-reports/page.tsx → lib/store-ops/permissions.ts

## Communities (37 total, 3 thin omitted)

### Community 0 - "Checklists and Shared Uploads"
Cohesion: 0.05
Nodes (71): HistoryItem, Checklist, ChecklistItem, Template, DamageReportFormProps, EditDamage(), EditIncident(), EditInspection() (+63 more)

### Community 1 - "Push Notification Infrastructure"
Cohesion: 0.05
Nodes (63): changeEmployeeRole(), changeSchema, labels, Role, EmployeesPage(), createServiceClient(), getAdminClient(), getStaffAccess (+55 more)

### Community 2 - "Shared Operations Types"
Cohesion: 0.05
Nodes (42): AuditRunnerProps, AuditsPage(), TemplatesSectionProps, TemplateListProps, AuditDetailViewProps, AuditDetailPage(), Props, deleteAuditTemplate() (+34 more)

### Community 3 - "Detail Actions and Transport"
Cohesion: 0.09
Nodes (19): DamageReportDetail(), DamageReportDetailProps, statusStyles, IncidentDetail(), RestockDetail(), ShelfInspectionDetail(), ShelfInspectionDetailProps, statusStyles (+11 more)

### Community 4 - "Management Permissions and Creation"
Cohesion: 0.11
Nodes (19): EditTesterPage(), EmployeeNewDamageReportPage(), EmployeeNewIncidentPage(), EmployeeNewRestockRequestPage(), EmployeeNewShelfInspectionPage(), NewDamageReportPage(), NewIncidentPage(), NewRestockRequestPage() (+11 more)

### Community 5 - "Restock Approval Workflow"
Cohesion: 0.14
Nodes (16): RestockDetailProps, statusStyles, RestockItemForm, cameraError(), CameraSession, requestCamera(), startAttendanceCamera(), approveRestockRequest() (+8 more)

### Community 6 - "Audit Execution and Templates"
Cohesion: 0.17
Nodes (10): loadNotificationFeed(), NotificationItem, NotificationScope, NotificationSnapshot, Feed, NotificationPanelProps, StandaloneNotificationPanel(), useNotificationFeed() (+2 more)

### Community 7 - "Reports and Exports"
Cohesion: 0.16
Nodes (11): Reports(), getDamageReturnList(), csvText(), downloadCsv(), ExportCell, Charts, metricLabels, OperationsReport (+3 more)

### Community 8 - "Form Draft Recovery"
Cohesion: 0.22
Nodes (8): AuditForm(), ChecklistTemplateForm(), DamageReportForm(), EmployeeFields(), Store, RestockForm(), AUDIT_CATEGORIES, useOperationsDraft()

### Community 9 - "Task Completion and Attachments"
Cohesion: 0.14
Nodes (11): addTaskComment(), cancelTask(), completeTask(), deleteTask(), deleteTaskAttachment(), saveTaskAttachment(), uploadTaskAttachment(), TaskWithRelations (+3 more)

### Community 10 - "Incidents and Private Media"
Cohesion: 0.06
Nodes (31): DamageReportCardProps, statusStyles, IncidentCardProps, priorityStyles, statusStyles, typeLabels, IncidentDetailProps, statusStyles (+23 more)

### Community 11 - "Incident Lists and Filters"
Cohesion: 0.23
Nodes (9): AccountRequestsPage(), metadata, supportEmailHref(), metadata, PrivacyPage(), metadata, SupportPage(), metadata (+1 more)

### Community 12 - "Task Assignment and Lists"
Cohesion: 0.13
Nodes (11): TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES, priorityStyles, statusStyles, TaskCardProps, TaskForm(), TaskFormProps (+3 more)

### Community 13 - "Tester Navigation"
Cohesion: 0.33
Nodes (3): metadata, EmployeeOperationPath, employeeOperationsModules

### Community 14 - "Audit Lists and Cards"
Cohesion: 0.22
Nodes (5): AuditCardProps, statusStyles, AuditListProps, statusStyles, AUDIT_STATUSES

### Community 15 - "Server Form Validation"
Cohesion: 0.19
Nodes (11): ChecklistTemplateFormProps, IncidentListProps, statusStyles, typeLabels, CHECKLIST_STATUSES, CHECKLIST_TYPES, DEFAULT_CLOSING_ITEMS, DEFAULT_OPENING_ITEMS (+3 more)

### Community 16 - "Tester Status Cards"
Cohesion: 0.50
Nodes (4): conditionStyles, expiryBadge(), TesterCard(), TesterCardProps

### Community 17 - "Shelf Inspection Navigation"
Cohesion: 0.10
Nodes (6): DamageReportsPage(), EmployeeDamageReportsPage(), SmartScanBranchSettings, SmartScanSettingsCommand, DamageReportWithRelations, createClient()

### Community 18 - "Community 18"
Cohesion: 0.22
Nodes (3): EmployeeRestockingPage(), RestockingPage(), RestockRequestWithRelations

### Community 19 - "Community 19"
Cohesion: 0.22
Nodes (3): EmployeeShelfInspectionsPage(), ShelfInspectionsPage(), ShelfInspectionWithRelations

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (4): TesterDetailPage(), TesterWithRelations, EmployeeTestersPage(), TestersPage()

### Community 21 - "Restock Lists and Cards"
Cohesion: 0.22
Nodes (5): RestockCardProps, statusStyles, RestockListProps, statusStyles, RESTOCK_STATUSES

### Community 22 - "Damage Approval Workflow"
Cohesion: 0.29
Nodes (3): EmployeeIncidentsPage(), IncidentsPage(), IncidentWithRelations

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (14): Props, ShelfInspectionForm(), Values, ShelfInspectionListProps, statusLabels, statusStyles, INSPECTION_STATUSES, useFormDraft() (+6 more)

### Community 24 - "Checklist and Damage Presentation"
Cohesion: 0.25
Nodes (4): TESTER_CONDITIONS, createClient(), condStyles, TesterListProps

### Community 26 - "Community 26"
Cohesion: 0.33
Nodes (4): DamageReportListProps, statusStyles, DAMAGE_REPORT_STATUSES, DAMAGE_TYPES

### Community 27 - "Community 27"
Cohesion: 0.40
Nodes (5): createTester(), updateTester(), validationMessage(), TesterForm(), TesterFormProps

## Knowledge Gaps
- **104 isolated node(s):** `displayFont`, `metadata`, `metadata`, `metadata`, `metadata` (+99 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `operationsContext()` connect `Checklists and Shared Uploads` to `Incidents and Private Media`, `Management Permissions and Creation`, `Restock Approval Workflow`, `Reports and Exports`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Shelf Inspection Navigation` to `Checklists and Shared Uploads`, `Push Notification Infrastructure`, `Shared Operations Types`, `Detail Actions and Transport`, `Management Permissions and Creation`, `Audit Execution and Templates`, `Task Completion and Attachments`, `Incidents and Private Media`, `Community 18`, `Community 19`, `Community 20`, `Damage Approval Workflow`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `can()` connect `Management Permissions and Creation` to `Checklists and Shared Uploads`, `Detail Actions and Transport`, `Task Completion and Attachments`, `Incidents and Private Media`, `Shelf Inspection Navigation`, `Community 18`, `Community 19`, `Community 20`, `Damage Approval Workflow`, `Community 27`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **What connects `displayFont`, `metadata`, `metadata` to the rest of the system?**
  _104 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Checklists and Shared Uploads` be split into smaller, more focused modules?**
  _Cohesion score 0.05168316831683168 - nodes in this community are weakly interconnected._
- **Should `Push Notification Infrastructure` be split into smaller, more focused modules?**
  _Cohesion score 0.051061388410786 - nodes in this community are weakly interconnected._
- **Should `Shared Operations Types` be split into smaller, more focused modules?**
  _Cohesion score 0.052884615384615384 - nodes in this community are weakly interconnected._