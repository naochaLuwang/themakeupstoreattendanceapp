# Attendance foundation architecture

Current update: PWA installation, service-worker caching/recovery and browser push have been removed. Native FCM integration and in-app history remain; Firebase setup is deferred. See [PWA removal](../pwa-removal.md).

`EmployeeShiftView` → compatible API route → `lib/attendance/http.ts` → `lib/attendance/server.ts` → typed `engine.ts` adapter → `public.attendance_transition` → authenticated private PostgreSQL implementation.

Server Actions for employee attendance, existing admin manual entries/edits/deletes, force checkout, and accidental-checkout approvals enter the same service. Three browser admin write paths now use those Actions rather than deleting/reopening/updating attendance directly. Legacy signatures and response fields remain available; new fields are additive.

The verified Supabase user supplies identity. The database rechecks the profile role, employee/branch/shift association, approved leave, active/completed attendance and location. It creates attendance timestamps. Client fields cannot label a manual command as QR or set its event time.

A transaction uses migration 005's lock order. It records a caller-scoped operation UUID and SHA-256 command fingerprint; matching successful retries return the saved outcome, and changed payloads cannot reuse the key. Exactly one expected session/version is closed. Unexpected multiple open legacy records require explicit review. No attendance or request mutation survives a later failure inside that operation.

A pending, non-writable operation row is the database's trusted command context. It cannot be forged through client-controlled session settings. Attendance triggers validate intervals, prevent additional active rows, increment versions and append old/new audit snapshots. Rejected RPC attempts roll back their operation and append a rejection event without retaining raw request payloads.

Configuration and authorization-field updates serialize with the engine. The original geofence radius and no-GPS manual clock-out remain. No early/late rounding or salary calculation is introduced. Schedules retain their legacy wall-clock convention; conversion to IST instants handles overnight eligibility. The existing accidental-checkout meaning (continue the same session) remains, with its original checkout retained in audit.

The employee's state comes from the shared read API. Its location acquisition respects effective branch accuracy/age limits before posting. Existing swipe controls, native feedback and the current employee design remain. Admin push notifications run after the response, only for changed employee actions; delivery failure cannot change attendance success. This is best effort until the durable notification module is implemented.

## Deliberate current boundaries

- The audit, infrastructure, QR station and Smart Scan modules are implemented locally. Branch QR flags remain disabled pending staging/device verification.
- Sources include manual/admin/legacy and verified Smart Scan. The QR transaction supplies a private verified context to the same attendance engine; ordinary callers cannot label themselves as QR. Future entry points must likewise verify their method before reusing the engine.
- Store assignment is `profiles.store_id`; temporary assignments and multiple organizations require additional schema/workflows.
- Multiple assigned shifts can be identified explicitly, but ambiguous automatic resolution fails. The existing employee home still does not present a split-shift picker.
- Old clock-out callers without a session/version have limited retry protection. Enable strict session binding after compatible clients are deployed.
- Audit captures original values but does not create the full employee correction/approval UI or a finalized-payroll lock service. Those are module 8. Existing paid settlements are never rewritten.

## Smart Scan path

Employee camera (local ZXing decode) → fresh foreground location → authenticated scan API → private QR transaction → station/device reauthorization and unique employee/token claim → existing attendance engine. Active attendance yields a 120-second employee/session/version confirmation instead of an automatic checkout. The confirmation path validates fresh location and current authorization before the same engine closes that session. Details: [Smart Scan](smart-scan.md).

## Module 5 — intelligent reminders

A separate durable server worker plans current shift/re-entry events, publishes recipient-only history and leases per-device delivery. It rechecks eligibility immediately before FCM HTTP v1 or browser VAPID requests; the transport cannot mutate attendance. Preferences, enrollment and branch timing use authenticated RPCs, while only the bearer-authenticated internal worker uses service-role RPC access. Provider errors do not affect attendance success. Legacy immediate admin push remains best effort. See [notification architecture and guarantees](notifications.md); actionable notification controls and geofences remain later work.
