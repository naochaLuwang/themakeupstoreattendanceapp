# Database changes

Apply `supabase/migrations/006_attendance_engine.sql` after migration 005, following staging verification. Store operations migrations are not a dependency. The original base schema is not present in this repository; inspect it using the read-only `supabase/checks/attendance_preflight.sql` before installation.

## Additions

- `attendance.version`: monotonically increased for each update, default 1 for historical records.
- Attendance metadata: `attendance_method`, `entry_point`, `verification_status`, location accuracy/capture time and distance. Historical records retain `legacy` metadata; their actual timestamps are not backfilled or changed.
- `attendance_policies`: per-store enforcement, optional strict GPS metadata/session binding, accuracy and age limits. No rows are automatically inserted or enabled for live stores. QR is reserved and cannot be enabled until its module installs a complete implementation.
- `attendance_operations`: actor-scoped operation UUID, command fingerprint, transaction context and stable successful response. No authenticated direct write grants.
- `attendance_audit_events`: append-only success, legacy-write, rejection and policy-change events with actor, branch, record, shift and redacted old/new values. Historical identity IDs intentionally are not cascading foreign keys: deleting an attendance record or account must not erase its event history.
- Lookup indexes support employee/session/date and audit/operation reads. There is no destructive cleanup or unique-index creation that would fail on existing duplicate sessions.

New tables have UUID IDs, created/updated timestamps and creator fields. New tables enable RLS with explicit grants; operations are visible only to their creator. Audit access is own employee, admin, or manager for the manager's non-null store. Policy reads are scoped to the assigned store or admin; only admins can modify policies. Trigger helpers have no client EXECUTE permission.

## Existing behavior repaired

The 005 association validator is extended to permit valid overnight check-in after midnight. Its permanent shift locks remain. Interval/version/open-session guards apply to future writes. Existing invalid/duplicate records are not deleted or rewritten. Admin manual preset IDs resolve to actual employee shifts rather than being saved as foreign keys to the wrong table.

The profile guard prevents self-assignment of role, branch or rate, and the store guard reserves coordinate/radius changes to admins. Review the live profile creation triggers and authorization grants in staging; this code cannot attest to unknown production policies or past unauthorized role assignments.

## Defaults and compatibility

Current store radius is retained, with the existing 100m fallback. Accuracy defaults to the existing radius threshold, not an imposed 50m production rule. Fresh supplied GPS metadata is validated; missing metadata remains accepted until `require_location_metadata` is enabled. The default maximum submitted location age is 30 seconds; the existing browser acquisition remains at least as strict.

`enforce_engine` starts false for staged server rollout. Until it is enabled for a store, legacy direct writes still exist and are audited; their previous security limitations must not be mistaken for fully enforced engine guarantees. The RPC always validates its commands. Enable `require_session_binding` for full expected-session/version protection after upgrading clients.

No payroll records, hourly rates, existing event times, schedules or organization-specific settings are rewritten by installation.

## Migration 007 — station preparation

After 006, apply the additive `007_attendance_stations.sql` only through an authorized staging rollout. It adds public station/device metadata, private hashed credentials/token material, explicit grants/RLS, constrained management/device/read-only verification RPCs and nullable station audit identity. It is rerunnable and leaves QR attendance disabled. Detailed relations, configuration, expiry/revocation, retention and security boundaries are in [stations.md](stations.md). No hosted migration has been applied.

## Smart Scan migration

`20261124080524_attendance_smart_scan.sql` follows 007. It adds two RLS-protected private tables for per-employee token attempts/confirmations and exact-operation receipts, six nullable checkout-provenance/quality columns, and the authenticated scan RPC. It replaces the existing engine/audit function definitions to admit only a verified transaction-scoped QR context. The reserved always-false QR constraint becomes an opt-in requiring engine enforcement; existing flags stay false. No old attendance/paid hours are rewritten. Schema, rollback and privacy/retention details are in [smart-scan.md](smart-scan.md). The staging preflight is `supabase/checks/smart_scan_preflight.sql`.
