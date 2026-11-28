# Graph Report - attendance-app  (2026-11-28)

## Corpus Check
- 176 files · ~58,971 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 665 nodes · 1656 edges · 33 communities (29 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `928f8d2a`
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
- [[_COMMUNITY_Restock Lists and Cards|Restock Lists and Cards]]
- [[_COMMUNITY_Damage Approval Workflow|Damage Approval Workflow]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Checklist and Damage Presentation|Checklist and Damage Presentation]]
- [[_COMMUNITY_Audit Queries and Routes|Audit Queries and Routes]]
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
7. `useOperationsDraft()` - 17 edges
8. `uploadOperationsImage()` - 16 edges
9. `canDelete()` - 15 edges
10. `runOperation()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `updateTesterCondition()` --calls--> `can()`  [EXTRACTED]
  app/actions/store-ops/testers.ts → lib/store-ops/permissions.ts
- `TaskListProps` --references--> `TaskWithRelations`  [EXTRACTED]
  components/store-ops/tasks/TaskList.tsx → lib/store-ops/types.ts
- `TaskForm()` --calls--> `useOperationsDraft()`  [EXTRACTED]
  components/store-ops/tasks/TaskForm.tsx → lib/store-ops/use-draft.ts
- `RestockListProps` --references--> `RestockRequestWithRelations`  [EXTRACTED]
  components/store-ops/restocking/RestockList.tsx → lib/store-ops/types.ts
- `DamageReportListProps` --references--> `DamageReportWithRelations`  [EXTRACTED]
  components/store-ops/damage-reports/DamageReportList.tsx → lib/store-ops/types.ts

## Communities (33 total, 4 thin omitted)

### Community 0 - "Checklists and Shared Uploads"
Cohesion: 0.05
Nodes (73): HistoryItem, Checklist, ChecklistItem, Template, EditDamage(), EditIncident(), EditInspection(), EditRestock() (+65 more)

### Community 1 - "Push Notification Infrastructure"
Cohesion: 0.06
Nodes (53): createServiceClient(), getAdminClient(), getStaffAccess, NewEmployeePage(), notificationProviders(), headers, notificationRequest(), notificationPath() (+45 more)

### Community 2 - "Shared Operations Types"
Cohesion: 0.07
Nodes (31): DamageReportDetailProps, statusStyles, Audit, AuditAnswer, AuditQuestion, AuditTemplate, Incident, IncidentComment (+23 more)

### Community 3 - "Detail Actions and Transport"
Cohesion: 0.12
Nodes (16): DamageReportDetail(), IncidentDetail(), RestockDetail(), ShelfInspectionDetail(), ShelfInspectionDetailProps, statusStyles, canDelete(), canManageApprovals() (+8 more)

### Community 4 - "Management Permissions and Creation"
Cohesion: 0.05
Nodes (35): TesterDetailPage(), DamageReportsPage(), EmployeeDamageReportsPage(), EditTesterPage(), EmployeeIncidentsPage(), IncidentsPage(), EmployeeNewDamageReportPage(), EmployeeNewIncidentPage() (+27 more)

### Community 5 - "Restock Approval Workflow"
Cohesion: 0.11
Nodes (17): RestockDetailProps, statusStyles, RestockItemForm, cameraError(), CameraSession, requestCamera(), startAttendanceCamera(), approveRestockRequest() (+9 more)

### Community 6 - "Audit Execution and Templates"
Cohesion: 0.12
Nodes (17): enableNativeNotifications(), postNotification(), enableEmployeePush(), loadNotificationFeed(), NotificationItem, NotificationScope, NotificationSnapshot, Feed (+9 more)

### Community 7 - "Reports and Exports"
Cohesion: 0.17
Nodes (10): Reports(), csvText(), downloadCsv(), ExportCell, Charts, metricLabels, OperationsReport, reportRange() (+2 more)

### Community 8 - "Form Draft Recovery"
Cohesion: 0.15
Nodes (13): AuditForm(), ChecklistTemplateForm(), DamageReportForm(), DamageReportFormProps, EmployeeFields(), Store, RestockForm(), DAMAGE_TYPES (+5 more)

### Community 9 - "Task Completion and Attachments"
Cohesion: 0.12
Nodes (14): addTaskComment(), cancelTask(), completeTask(), createTask(), deleteTask(), deleteTaskAttachment(), saveTaskAttachment(), uploadTaskAttachment() (+6 more)

### Community 10 - "Incidents and Private Media"
Cohesion: 0.07
Nodes (24): DamageReportCardProps, statusStyles, IncidentCardProps, priorityStyles, statusStyles, typeLabels, IncidentDetailProps, statusStyles (+16 more)

### Community 11 - "Incident Lists and Filters"
Cohesion: 0.23
Nodes (9): AccountRequestsPage(), metadata, supportEmailHref(), metadata, PrivacyPage(), metadata, SupportPage(), metadata (+1 more)

### Community 12 - "Task Assignment and Lists"
Cohesion: 0.17
Nodes (10): TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES, getEmployees(), updateTask(), TaskForm(), TaskFormProps, priorityTableStyles (+2 more)

### Community 13 - "Tester Navigation"
Cohesion: 0.33
Nodes (3): metadata, EmployeeOperationPath, employeeOperationsModules

### Community 14 - "Audit Lists and Cards"
Cohesion: 0.24
Nodes (8): statusStyles, ChecklistTemplateFormProps, AUDIT_CATEGORIES, AUDIT_STATUSES, CHECKLIST_STATUSES, CHECKLIST_TYPES, DEFAULT_CLOSING_ITEMS, DEFAULT_OPENING_ITEMS

### Community 15 - "Server Form Validation"
Cohesion: 0.17
Nodes (10): IncidentForm(), IncidentFormProps, typeLabels, IncidentListProps, statusStyles, typeLabels, INCIDENT_PRIORITIES, INCIDENT_STATUSES (+2 more)

### Community 16 - "Tester Status Cards"
Cohesion: 0.50
Nodes (4): conditionStyles, expiryBadge(), TesterCard(), TesterCardProps

### Community 21 - "Restock Lists and Cards"
Cohesion: 0.22
Nodes (5): RestockCardProps, statusStyles, RestockListProps, statusStyles, RESTOCK_STATUSES

### Community 22 - "Damage Approval Workflow"
Cohesion: 0.09
Nodes (19): AuditListProps, AuditRunnerProps, AuditsPage(), TemplatesSectionProps, TemplateListProps, AuditDetailViewProps, AuditDetailPage(), Props (+11 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (10): ShelfInspectionListProps, statusLabels, statusStyles, INSPECTION_STATUSES, damageSchema, imageUrls, incidentSchema, optionalText (+2 more)

### Community 24 - "Checklist and Damage Presentation"
Cohesion: 0.27
Nodes (4): DamageReportListProps, statusStyles, DAMAGE_REPORT_STATUSES, createClient()

### Community 29 - "Task Priority Cards"
Cohesion: 0.40
Nodes (3): priorityStyles, statusStyles, TaskCardProps

## Knowledge Gaps
- **101 isolated node(s):** `displayFont`, `metadata`, `metadata`, `metadata`, `metadata` (+96 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `operationsContext()` connect `Checklists and Shared Uploads` to `Management Permissions and Creation`, `Restock Approval Workflow`, `Audit Execution and Templates`, `Reports and Exports`, `Incidents and Private Media`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Management Permissions and Creation` to `Checklists and Shared Uploads`, `Push Notification Infrastructure`, `Shared Operations Types`, `Detail Actions and Transport`, `Restock Approval Workflow`, `Audit Execution and Templates`, `Task Completion and Attachments`, `Incidents and Private Media`, `Damage Approval Workflow`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Why does `can()` connect `Management Permissions and Creation` to `Checklists and Shared Uploads`, `Detail Actions and Transport`, `Form Draft Recovery`, `Task Completion and Attachments`, `Incidents and Private Media`, `Task Assignment and Lists`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **What connects `displayFont`, `metadata`, `metadata` to the rest of the system?**
  _101 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Checklists and Shared Uploads` be split into smaller, more focused modules?**
  _Cohesion score 0.05238796549547654 - nodes in this community are weakly interconnected._
- **Should `Push Notification Infrastructure` be split into smaller, more focused modules?**
  _Cohesion score 0.06308610400682012 - nodes in this community are weakly interconnected._
- **Should `Shared Operations Types` be split into smaller, more focused modules?**
  _Cohesion score 0.06753006475485661 - nodes in this community are weakly interconnected._