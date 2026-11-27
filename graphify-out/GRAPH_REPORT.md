# Graph Report - attendance-app  (2026-11-27)

## Corpus Check
- 166 files · ~56,417 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 636 nodes · 1615 edges · 49 communities (43 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5de5aad0`
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
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]

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

## Communities (49 total, 6 thin omitted)

### Community 0 - "Checklists and Shared Uploads"
Cohesion: 0.14
Nodes (16): HistoryItem, Checklist, ChecklistItem, Template, completeChecklistItem(), completeDailyChecklist(), deleteTemplate(), getChecklistHistory() (+8 more)

### Community 1 - "Push Notification Infrastructure"
Cohesion: 0.07
Nodes (52): createServiceClient(), getAdminClient(), notificationProviders(), headers, notificationRequest(), notificationPath(), createNotificationDispatcher(), Delivery (+44 more)

### Community 2 - "Shared Operations Types"
Cohesion: 0.07
Nodes (32): TemplatesSectionProps, deleteAuditTemplate(), Audit, AuditAnswer, AuditQuestion, AuditTemplate, Incident, IncidentComment (+24 more)

### Community 3 - "Detail Actions and Transport"
Cohesion: 0.22
Nodes (10): DamageReportDetail(), DamageReportDetailProps, statusStyles, IncidentDetail(), RestockDetail(), ShelfInspectionDetail(), canDelete(), canManageApprovals() (+2 more)

### Community 4 - "Management Permissions and Creation"
Cohesion: 0.10
Nodes (22): EditTesterPage(), EmployeeNewDamageReportPage(), EmployeeNewIncidentPage(), EmployeeNewRestockRequestPage(), EmployeeNewShelfInspectionPage(), NewDamageReportPage(), NewIncidentPage(), NewRestockRequestPage() (+14 more)

### Community 5 - "Restock Approval Workflow"
Cohesion: 0.13
Nodes (18): RestockDetailProps, statusStyles, RestockForm(), RestockItemForm, cameraError(), CameraSession, requestCamera(), startAttendanceCamera() (+10 more)

### Community 6 - "Audit Execution and Templates"
Cohesion: 0.12
Nodes (16): enableNativeNotifications(), postNotification(), enableEmployeePush(), loadNotificationFeed(), NotificationItem, NotificationScope, NotificationSnapshot, Feed (+8 more)

### Community 7 - "Reports and Exports"
Cohesion: 0.17
Nodes (10): Reports(), csvText(), downloadCsv(), ExportCell, Charts, metricLabels, OperationsReport, reportRange() (+2 more)

### Community 8 - "Form Draft Recovery"
Cohesion: 0.17
Nodes (12): AuditForm(), ChecklistTemplateForm(), DamageReportForm(), DamageReportFormProps, DAMAGE_TYPES, TESTER_CONDITIONS, uploadDamageImage(), createTester() (+4 more)

### Community 9 - "Task Completion and Attachments"
Cohesion: 0.13
Nodes (7): deleteTaskAttachment(), saveTaskAttachment(), TaskWithRelations, TasksPage(), priorityStyles, statusStyles, TaskDetailProps

### Community 10 - "Incidents and Private Media"
Cohesion: 0.15
Nodes (11): IncidentForm(), IncidentFormProps, typeLabels, IncidentListProps, statusStyles, typeLabels, INCIDENT_PRIORITIES, INCIDENT_STATUSES (+3 more)

### Community 11 - "Incident Lists and Filters"
Cohesion: 0.22
Nodes (3): DamageReportsPage(), EmployeeDamageReportsPage(), DamageReportWithRelations

### Community 12 - "Task Assignment and Lists"
Cohesion: 0.20
Nodes (8): TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES, TaskForm(), TaskFormProps, priorityTableStyles, statusStyles, TaskListProps

### Community 13 - "Tester Navigation"
Cohesion: 0.33
Nodes (3): metadata, EmployeeOperationPath, employeeOperationsModules

### Community 14 - "Audit Lists and Cards"
Cohesion: 0.20
Nodes (6): AuditCardProps, statusStyles, AuditListProps, statusStyles, AUDIT_CATEGORIES, AUDIT_STATUSES

### Community 15 - "Server Form Validation"
Cohesion: 0.36
Nodes (6): ChecklistTemplateFormProps, CHECKLIST_STATUSES, CHECKLIST_TYPES, DEFAULT_CLOSING_ITEMS, DEFAULT_OPENING_ITEMS, createTemplate()

### Community 16 - "Tester Status Cards"
Cohesion: 0.50
Nodes (4): conditionStyles, expiryBadge(), TesterCard(), TesterCardProps

### Community 17 - "Shelf Inspection Navigation"
Cohesion: 0.16
Nodes (15): Props, ShelfInspectionForm(), Values, addInspectionComment(), approveShelfInspection(), createShelfInspection(), createStoreSection(), deleteStoreSection() (+7 more)

### Community 18 - "Operations Routes and Access"
Cohesion: 0.10
Nodes (7): EmployeeIncidentsPage(), IncidentsPage(), EmployeeShelfInspectionsPage(), ShelfInspectionsPage(), IncidentWithRelations, ShelfInspectionWithRelations, createClient()

### Community 19 - "Restock Navigation"
Cohesion: 0.22
Nodes (3): EmployeeRestockingPage(), RestockingPage(), RestockRequestWithRelations

### Community 20 - "Incident Navigation"
Cohesion: 0.20
Nodes (16): completeAudit(), createAuditTemplate(), deleteAudit(), startAudit(), submitAuditAnswer(), operationError(), deleteDamageImage(), deleteDamageReport() (+8 more)

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
Cohesion: 0.19
Nodes (6): DamageReportListProps, statusStyles, DAMAGE_REPORT_STATUSES, createClient(), condStyles, TesterListProps

### Community 25 - "Audit Queries and Routes"
Cohesion: 0.15
Nodes (10): AuditRunnerProps, AuditDetailViewProps, AuditDetailPage(), Props, getAuditById(), uploadAuditImage(), encode(), prepareImage() (+2 more)

### Community 26 - "Community 26"
Cohesion: 0.19
Nodes (10): EditDamage(), EditIncident(), EditInspection(), EditRestock(), EditTask(), Notifications(), OperationsSettings(), operationsContext() (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.15
Nodes (14): addIncidentComment(), assignIncident(), deleteIncident(), deleteIncidentImage(), saveIncident(), updateIncidentStatus(), uploadIncidentVoice(), damageSchema (+6 more)

### Community 29 - "Task Priority Cards"
Cohesion: 0.40
Nodes (3): priorityStyles, statusStyles, TaskCardProps

### Community 33 - "Community 33"
Cohesion: 0.21
Nodes (7): deleteTester(), logTesterAction(), markNeedsReplacement(), updateTesterCondition(), testerSchema, conditionStyles, TesterDetailProps

### Community 34 - "Community 34"
Cohesion: 0.20
Nodes (4): TemplateListProps, ShelfInspectionDetailProps, statusStyles, runOperation()

### Community 39 - "Community 39"
Cohesion: 0.27
Nodes (10): addDamageComment(), approveDamageReport(), archiveDamageReport(), createDamageReport(), getDamageReturnList(), rejectDamageReport(), Report, review() (+2 more)

### Community 40 - "Community 40"
Cohesion: 0.42
Nodes (5): GET(), mediaPath(), mediaUrl(), StoreImage(), VoiceNote()

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (4): TesterDetailPage(), TesterWithRelations, EmployeeTestersPage(), TestersPage()

### Community 42 - "Community 42"
Cohesion: 0.29
Nodes (3): IncidentDetailProps, statusStyles, typeLabels

### Community 43 - "Community 43"
Cohesion: 0.33
Nodes (4): IncidentCardProps, priorityStyles, statusStyles, typeLabels

## Knowledge Gaps
- **95 isolated node(s):** `Report`, `templateSchema`, `itemsSchema`, `StoreOpsNavProps`, `modules` (+90 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `operationsContext()` connect `Community 26` to `Checklists and Shared Uploads`, `Management Permissions and Creation`, `Restock Approval Workflow`, `Audit Execution and Templates`, `Community 39`, `Community 40`, `Reports and Exports`, `Community 44`, `Shelf Inspection Navigation`, `Incident Navigation`, `Community 27`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Operations Routes and Access` to `Community 33`, `Push Notification Infrastructure`, `Shared Operations Types`, `Management Permissions and Creation`, `Audit Execution and Templates`, `Task Completion and Attachments`, `Community 41`, `Incident Lists and Filters`, `Community 47`, `Restock Navigation`, `Incident Navigation`, `Damage Approval Workflow`, `Audit Queries and Routes`, `Community 26`, `Community 27`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `can()` connect `Management Permissions and Creation` to `Community 33`, `Form Draft Recovery`, `Task Completion and Attachments`, `Community 41`, `Incident Lists and Filters`, `Operations Routes and Access`, `Restock Navigation`, `Community 26`, `Community 27`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **What connects `Report`, `templateSchema`, `itemsSchema` to the rest of the system?**
  _95 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Checklists and Shared Uploads` be split into smaller, more focused modules?**
  _Cohesion score 0.1380952380952381 - nodes in this community are weakly interconnected._
- **Should `Push Notification Infrastructure` be split into smaller, more focused modules?**
  _Cohesion score 0.06648575305291723 - nodes in this community are weakly interconnected._
- **Should `Shared Operations Types` be split into smaller, more focused modules?**
  _Cohesion score 0.0743321718931475 - nodes in this community are weakly interconnected._