# Graph Report - attendance-app  (2026-11-27)

## Corpus Check
- 174 files · ~58,499 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 658 nodes · 1644 edges · 42 communities (39 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5e84f828`
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
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 41|Community 41]]

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

## Communities (42 total, 3 thin omitted)

### Community 0 - "Checklists and Shared Uploads"
Cohesion: 0.13
Nodes (17): HistoryItem, Checklist, ChecklistItem, Template, completeChecklistItem(), completeDailyChecklist(), createTemplate(), deleteTemplate() (+9 more)

### Community 1 - "Push Notification Infrastructure"
Cohesion: 0.07
Nodes (51): createServiceClient(), getAdminClient(), notificationProviders(), headers, notificationRequest(), notificationPath(), createNotificationDispatcher(), Delivery (+43 more)

### Community 2 - "Shared Operations Types"
Cohesion: 0.06
Nodes (36): AuditListProps, AuditRunnerProps, TemplatesSectionProps, AuditDetailViewProps, deleteAuditTemplate(), Audit, AuditAnswer, AuditQuestion (+28 more)

### Community 3 - "Detail Actions and Transport"
Cohesion: 0.08
Nodes (21): TemplateListProps, DamageReportDetail(), DamageReportDetailProps, statusStyles, IncidentDetail(), RestockDetail(), ShelfInspectionDetail(), ShelfInspectionDetailProps (+13 more)

### Community 4 - "Management Permissions and Creation"
Cohesion: 0.11
Nodes (19): EditTesterPage(), EmployeeNewDamageReportPage(), EmployeeNewIncidentPage(), EmployeeNewRestockRequestPage(), EmployeeNewShelfInspectionPage(), NewDamageReportPage(), NewIncidentPage(), NewRestockRequestPage() (+11 more)

### Community 5 - "Restock Approval Workflow"
Cohesion: 0.13
Nodes (18): RestockDetailProps, statusStyles, RestockForm(), RestockItemForm, cameraError(), CameraSession, requestCamera(), startAttendanceCamera() (+10 more)

### Community 6 - "Audit Execution and Templates"
Cohesion: 0.12
Nodes (17): enableNativeNotifications(), postNotification(), enableEmployeePush(), loadNotificationFeed(), NotificationItem, NotificationScope, NotificationSnapshot, Feed (+9 more)

### Community 7 - "Reports and Exports"
Cohesion: 0.17
Nodes (10): Reports(), csvText(), downloadCsv(), ExportCell, Charts, metricLabels, OperationsReport, reportRange() (+2 more)

### Community 8 - "Form Draft Recovery"
Cohesion: 0.19
Nodes (11): AuditForm(), ChecklistTemplateForm(), DamageReportForm(), DamageReportFormProps, DAMAGE_TYPES, createTester(), updateTester(), useOperationsDraft() (+3 more)

### Community 9 - "Task Completion and Attachments"
Cohesion: 0.12
Nodes (12): addTaskComment(), cancelTask(), completeTask(), deleteTask(), deleteTaskAttachment(), saveTaskAttachment(), uploadTaskAttachment(), TaskWithRelations (+4 more)

### Community 10 - "Incidents and Private Media"
Cohesion: 0.05
Nodes (36): DamageReportCardProps, statusStyles, IncidentCardProps, priorityStyles, statusStyles, typeLabels, IncidentDetailProps, statusStyles (+28 more)

### Community 11 - "Incident Lists and Filters"
Cohesion: 0.23
Nodes (9): AccountRequestsPage(), metadata, supportEmailHref(), metadata, PrivacyPage(), metadata, SupportPage(), metadata (+1 more)

### Community 12 - "Task Assignment and Lists"
Cohesion: 0.19
Nodes (11): ChecklistTemplateFormProps, CHECKLIST_STATUSES, CHECKLIST_TYPES, DEFAULT_CLOSING_ITEMS, DEFAULT_OPENING_ITEMS, TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES (+3 more)

### Community 13 - "Tester Navigation"
Cohesion: 0.33
Nodes (3): metadata, EmployeeOperationPath, employeeOperationsModules

### Community 14 - "Audit Lists and Cards"
Cohesion: 0.22
Nodes (5): AuditCardProps, statusStyles, statusStyles, AUDIT_CATEGORIES, AUDIT_STATUSES

### Community 15 - "Server Form Validation"
Cohesion: 0.22
Nodes (3): EmployeeIncidentsPage(), IncidentsPage(), IncidentWithRelations

### Community 16 - "Tester Status Cards"
Cohesion: 0.50
Nodes (4): conditionStyles, expiryBadge(), TesterCard(), TesterCardProps

### Community 17 - "Shelf Inspection Navigation"
Cohesion: 0.15
Nodes (16): Props, ShelfInspectionForm(), Values, addInspectionComment(), approveShelfInspection(), createShelfInspection(), createStoreSection(), deleteStoreSection() (+8 more)

### Community 18 - "Operations Routes and Access"
Cohesion: 0.09
Nodes (6): DamageReportsPage(), EmployeeDamageReportsPage(), SmartScanBranchSettings, SmartScanSettingsCommand, DamageReportWithRelations, createClient()

### Community 19 - "Restock Navigation"
Cohesion: 0.29
Nodes (3): EmployeeRestockingPage(), RestockingPage(), RestockRequestWithRelations

### Community 20 - "Incident Navigation"
Cohesion: 0.20
Nodes (17): completeAudit(), createAuditTemplate(), deleteAudit(), startAudit(), submitAuditAnswer(), uploadAuditImage(), operationError(), deleteDamageImage() (+9 more)

### Community 21 - "Restock Lists and Cards"
Cohesion: 0.22
Nodes (5): RestockCardProps, statusStyles, RestockListProps, statusStyles, RESTOCK_STATUSES

### Community 22 - "Damage Approval Workflow"
Cohesion: 0.33
Nodes (6): AuditsPage(), AuditDetailPage(), Props, getAuditById(), getAudits(), getAuditTemplates()

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (4): ShelfInspectionListProps, statusLabels, statusStyles, INSPECTION_STATUSES

### Community 24 - "Checklist and Damage Presentation"
Cohesion: 0.28
Nodes (4): DamageReportListProps, statusStyles, DAMAGE_REPORT_STATUSES, createClient()

### Community 26 - "Community 26"
Cohesion: 0.17
Nodes (11): EditDamage(), EditIncident(), EditInspection(), EditRestock(), EditTask(), Notifications(), OperationsSettings(), operationsContext() (+3 more)

### Community 27 - "Community 27"
Cohesion: 0.22
Nodes (7): saveOperationsSettings(), damageSchema, imageUrls, incidentSchema, optionalText, taskSchema, uuid

### Community 29 - "Task Priority Cards"
Cohesion: 0.40
Nodes (3): priorityStyles, statusStyles, TaskCardProps

### Community 33 - "Community 33"
Cohesion: 0.29
Nodes (3): EmployeeShelfInspectionsPage(), ShelfInspectionsPage(), ShelfInspectionWithRelations

### Community 34 - "Community 34"
Cohesion: 0.40
Nodes (3): TESTER_CONDITIONS, condStyles, TesterListProps

### Community 39 - "Community 39"
Cohesion: 0.24
Nodes (11): addDamageComment(), approveDamageReport(), archiveDamageReport(), createDamageReport(), getDamageReturnList(), rejectDamageReport(), Report, review() (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (4): TesterDetailPage(), TesterWithRelations, EmployeeTestersPage(), TestersPage()

## Knowledge Gaps
- **100 isolated node(s):** `displayFont`, `metadata`, `metadata`, `metadata`, `metadata` (+95 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `operationsContext()` connect `Community 26` to `Checklists and Shared Uploads`, `Management Permissions and Creation`, `Restock Approval Workflow`, `Audit Execution and Templates`, `Community 39`, `Reports and Exports`, `Incidents and Private Media`, `Shelf Inspection Navigation`, `Incident Navigation`, `Community 27`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Operations Routes and Access` to `Community 33`, `Push Notification Infrastructure`, `Detail Actions and Transport`, `Management Permissions and Creation`, `Shared Operations Types`, `Audit Execution and Templates`, `Task Completion and Attachments`, `Incidents and Private Media`, `Community 41`, `Server Form Validation`, `Restock Navigation`, `Incident Navigation`, `Damage Approval Workflow`, `Community 26`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `can()` connect `Management Permissions and Creation` to `Community 33`, `Detail Actions and Transport`, `Form Draft Recovery`, `Task Completion and Attachments`, `Incidents and Private Media`, `Community 41`, `Server Form Validation`, `Operations Routes and Access`, `Restock Navigation`, `Community 26`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `displayFont`, `metadata`, `metadata` to the rest of the system?**
  _100 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Checklists and Shared Uploads` be split into smaller, more focused modules?**
  _Cohesion score 0.1341991341991342 - nodes in this community are weakly interconnected._
- **Should `Push Notification Infrastructure` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `Shared Operations Types` be split into smaller, more focused modules?**
  _Cohesion score 0.06377551020408163 - nodes in this community are weakly interconnected._