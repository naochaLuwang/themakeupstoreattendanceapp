# Store Operations Module
Project: THE MAKEUP STORE WANGKHEI

## Objective

Extend the existing Next.js + Supabase project by adding a complete Store Operations module.

DO NOT modify or break any existing functionality.

This is NOT a replacement for our POS (BillBook).

This module manages everyday store operations such as:

- Shelf inspection
- Daily checklists
- Damage reporting
- Tester management
- Task management
- Store audits
- Incident reports
- Restocking requests
- Notifications
- Reports

The project already contains authentication.

Reuse existing components whenever possible.

Follow the existing folder structure and coding style.

Never rewrite existing pages unless necessary.

Always build production-ready code.

---

# Tech Stack

Next.js (App Router)

TypeScript

TailwindCSS

Supabase

Supabase Auth

Supabase Storage

Supabase Realtime

React Hook Form

Zod

Server Actions where appropriate

---

# General Rules

Create modular code.

Never create duplicate utilities.

Never create duplicate UI components.

Keep pages lightweight.

Move business logic into reusable services.

Use optimistic updates where appropriate.

Implement loading states.

Implement empty states.

Implement error handling.

Implement skeleton loaders.

Use responsive mobile-first layouts.

Follow accessibility best practices.

Never hardcode IDs.

Always use UUIDs.

Every table must have:

id

created_at

updated_at

created_by

---

# Roles

Admin

Manager

Employee

Permissions:

Employee

- submit reports
- upload photos
- complete tasks

Manager

- approve reports
- assign tasks
- run audits

Admin

- everything

---

# Navigation

Add a new sidebar section:

Store Operations

Modules:

Dashboard

Shelf Inspection

Damage Reports

Tester Management

Daily Checklist

Tasks

Store Audits

Incidents

Restocking

Reports

Settings

---

# MODULE 1

Shelf Inspection

Purpose:

Employees inspect shelves daily.

Features:

Create inspection

Choose section

Take photos

Add notes

Status:

Good

Needs Restock

Dirty

Wrong Display

Missing Tester

Missing Price Tag

Damaged Display

Manager approval workflow

History

Search

Filters

Pagination

Image gallery

Realtime updates

---

Database

store_sections

shelf_inspections

inspection_images

inspection_comments

---

MODULE 2

Damage Reporting

Employee can report damaged products.

Fields:

Barcode

Product Name

Brand

Shade

Batch

MRP

Quantity

Damage Type

Photos

Description

Reported By

Date

Approval Status

Damage Types:

Broken

Leaking

Expired

Packaging Damage

Customer Damage

Supplier Damage

Missing Item

Tester Finished

Manager Approval

Reject

Approve

Archive

Generate return list

---

Database

damage_reports

damage_images

damage_comments

---

MODULE 3

Tester Management

Track every tester.

Fields

Product

Brand

Shade

Opened Date

Expiry

Condition

Remaining %

Needs Replacement

History

Alerts

Dashboard cards

Upcoming expiry

Already expired

Needs replacement

---

Database

testers

tester_logs

---

MODULE 4

Daily Checklist

Opening Checklist

Closing Checklist

Checklist templates

Task status

Completed by

Timestamp

Photo proof

Mandatory completion

Templates editable

Example:

Unlock Store

Count Cash

Switch Lights

Clean Mirrors

Arrange Displays

Sanitize Testers

Open POS

etc

Closing

Lock Cabinets

Count Cash

Turn Off Lights

Upload Photos

Lock Store

---

Database

checklist_templates

daily_checklists

daily_checklist_items

---

MODULE 5

Task Management

Managers create tasks.

Assign employee.

Priority

Due Date

Status

Photos

Comments

History

Recurring tasks

Task categories

Restock

Cleaning

Inventory

Maintenance

Promotion

General

Realtime updates

---

Database

tasks

task_comments

task_attachments

---

MODULE 6

Store Audits

Manager visits store.

Audit categories

Display

Cleanliness

Staff

Lighting

Product Placement

Price Tags

Promotions

Safety

Every question has:

Score

Comment

Photo

Final Score

History

Charts

---

Database

audit_templates

audits

audit_answers

---

MODULE 7

Incident Reports

Employees report:

Customer Complaint

Power Failure

Internet Down

Theft

Broken Fixture

Emergency

Medical

Other

Priority

Photo

Voice Note

Description

Status

Assigned To

History

---

Database

incidents

incident_images

incident_comments

---

MODULE 8

Restocking

Employee scans barcode.

Enter quantity needed.

Manager approval.

Completed status.

Restock history.

Supplier notes.

Barcode search.

---

Database

restock_requests

restock_items

---

MODULE 9

Notifications

Realtime notifications.

Low Stock

Task Assigned

Task Completed

Checklist Pending

Inspection Pending

Damage Approved

Tester Expired

Audit Due

Store Closed Late

Push notification support.

Realtime support.

---

MODULE 10

Reports

Dashboard

Daily

Weekly

Monthly

Reports:

Inspection Completion

Damage Value

Employee Performance

Task Completion

Store Audit Score

Checklist Compliance

Incident Trends

Tester Usage

CSV Export

PDF Export

Charts

---

Dashboard

Cards

Today's Tasks

Pending Damage Reports

Open Incidents

Checklist Status

Store Audit Score

Pending Restocks

Expiring Testers

Notifications

Activity Feed

Quick Actions

Recent Photos

---

Images

Store every uploaded image inside Supabase Storage.

Generate thumbnails.

Allow fullscreen preview.

Delete images safely.

---

Forms

Every form should include:

Validation

Error states

Autosave drafts

Mobile optimized

Image compression before upload

---

UI

Use shadcn/ui if available.

Otherwise reuse existing components.

Responsive.

Dark mode compatible.

Clean enterprise design.

Avoid unnecessary animations.

---

Coding Standards

Strong TypeScript typing.

No any.

Reusable hooks.

Server Components where possible.

Client Components only when required.

Proper loading.tsx

Proper error.tsx

Suspense support.

Database queries isolated.

No duplicated code.

---

Deliverables

For every module:

1. Database schema

2. Supabase SQL migration

3. TypeScript types

4. API / Server Actions

5. UI

6. Forms

7. Tables

8. Detail pages

9. Edit pages

10. Delete functionality

11. Permissions

12. Realtime updates

13. Mobile support

14. Documentation

---

IMPORTANT

Do NOT attempt to build everything in one commit.

Implement one module at a time.

After each module:

- ensure TypeScript passes
- ensure ESLint passes
- ensure no existing feature breaks
- document all schema changes
- wait before starting the next module
