# Employee Smart Scan — module 4

## Live configuration update — 26 November 2026

Main Branch had no `attendance_policies` row, so both the employee Home action and scanner defaulted to disabled despite existing stations and a hosted scanner API. An authorized configuration update created its policy with `smart_qr_enabled=true` and `enforce_engine=true`. Read-back verified both flags, the existing location/radius, and unchanged manual strictness defaults. This session applied no migrations and deployed no web code. The historical local implementation notes below describe the original module checkpoint.

Two active stations exist, but the live check found **zero authorized displays**. On a store computer or tablet, open **Admin → Attendance stations → Open display**, start authorization, then enter its displayed pairing code under **Authorize display** in the admin workspace. Verify the physical device before approval. Employees must sign in with an employee or manager account, reopen Home and choose **Smart Scan**, or go directly to `/employee/smart-scan`. The code rotates automatically after pairing. Administrators manage stations and do not have employee scan access.

The accompanying source fix keeps the Home **Smart Scan** link visible even when branch setup is incomplete, a shift is complete, no shift is scheduled, or attendance is loading. Disabled branches get setup guidance; manual controls retain their original eligibility. **Branch Smart Scan** controls on the admin stations page create a missing policy or update its displayed version, enforce admin authorization and database RLS, check scanner installation/location before enabling, and preserve unrelated settings. Disabling QR retains engine enforcement and attendance history. No new schema or migration is needed. These UI improvements still require deployment to the existing Hostinger website; installing the same APK alone does not publish them.

Verification: production web build, standalone TypeScript, changed-file ESLint, all 108 Node tests, and disposable PostgreSQL scanner/engine/station/shift suites pass. Repository-wide `npm run lint` includes generated `.next` files and failed while those build files were being regenerated; scoped source lint passes. No physical employee scan was performed. Live configuration evidence is in `output/verification/smart-attendance/activation/live-settings.json`.

## Original module checkpoint — 24 November 2026

Implemented locally, 24 November 2026. This adds employee camera scanning, authenticated QR redemption through the attendance engine, fresh foreground location, explicit clock-out confirmation, feedback and manual fallback. No branch has been enabled, no hosted migration/deployment was performed, and no physical Android camera was tested.

## Employee experience

- An enabled branch gets a prominent **Smart Scan** action on the existing home attendance card. It stays above the bottom dock at 360 × 640. The existing swipe sits under **Use manual attendance**; the scanner's fallback link opens it directly.
- `/employee/smart-scan` loads branch/state settings on the server. When enabled and eligible for scanning, it opens the rear camera, decodes the display's opaque attendance QR locally, stops the camera and obtains location. Camera frames are never sent to an API or QR provider.
- The server chooses the action. Eligible employees clock in directly; an active session receives a **Confirm clock out** screen with original clock-in, elapsed time, branch and scheduled finish. Scanning alone never closes attendance.
- Confirmation lasts 120 seconds, binds the exact employee/session/version, and requires another fresh location. It can outlive the originally scanned QR, but not its own expiry. Station/device authorization and branch assignment are checked again before closing.
- Already-completed or review-required attendance does not request the camera. Leave, off days, ambiguous shifts and completed-shift restart are rejected by the shared engine; existing authorized re-entry remains on Home.
- Location acquisition has a 15-second total deadline for Smart Scan, with precise-location, entrance, retry and manager-correction guidance. It reuses existing acquisition/refinement without widening the store radius. Manual clock-out retains its existing no-GPS behavior.
- Camera denial/busy/unavailable/timeout states explain recovery. Torch appears only when supported. Pausing, backgrounding, success and leaving release tracks; returning from the background requires explicit resume. A late camera-permission response after cancellation is disposed.
- Repeated frames are suppressed before GPS or network submission. Network uncertainty never displays success or queues a background attendance action. **Retry the same request** preserves its original UUID and GPS body; **Refresh attendance** reads authoritative state. A stale unsaved location requires a fresh scan.
- Success uses recorded server time and the existing native feedback bridge. Home already subscribes to attendance Realtime; a local attendance event and router refresh additionally update the returning view. No new tab or replacement employee design is introduced.

## Migration and data

Apply `supabase/migrations/20261124080524_attendance_smart_scan.sql` after 005, 006 and 007. The timestamped file was generated by the installed Supabase CLI. It is additive and rerunnable; no existing migration is rewritten.

| Change | Purpose |
| --- | --- |
| `hrm_private.attendance_qr_attempts` | Unique employee/token redemption, confirmation/session binding, saved outcomes and temporary verified engine context |
| `hrm_private.attendance_qr_operations` | Authenticated actor/operation UUID, command digest and successful response for exact retries |
| Nullable checkout metadata on `attendance` | `check_out_method`, entry point, verification status, location accuracy/capture time and distance |
| `attendance_policies` constraint | Removes the reserved always-false QR check; requires `enforce_engine` whenever `smart_qr_enabled` is true; default stays false |
| RPCs/functions | Authenticated `attendance_smart_scan`, private orchestration/location verification, updated existing engine/audit function definitions |

Both new private tables have UUID IDs, created/updated timestamps and creator IDs, enable RLS and grant no client table access. No raw QR, camera frame, device credential or submitted command body is stored in them. Successful response snapshots can contain existing employee attendance geotags; they are private and available only through that actor's matching authenticated receipt. Set an approved receipt/audit retention policy before broad rollout; no destructive retention job is scheduled here.

An employee/token pair can cause at most one attendance action. Successful receipts remain after QR expiry so an exact lost-response retry can recover its original result without another mutation. Expired codes cannot initiate new actions. Multiple employees may redeem the same valid display QR independently.

Existing check-in provenance remains intact: QR checkout of a manually started session records `check_out_method=smart_qr` while `attendance_method` remains `manual`. QR check-in uses `smart_qr`/`smart_scan`/`verified_qr`. Audit source reflects each actual operation; raw check-in coordinates remain redacted from audit snapshots. Historical checkout metadata is not backfilled.

## Transaction/security boundary

`public.attendance_smart_scan` is an authenticated SECURITY INVOKER wrapper. Private implementations use fixed empty search paths, explicit authentication/profile authorization, and no anonymous grants. The server uses verified Supabase cookie identity and no service-role key. Employee/store/session identities are derived server-side, never accepted from scan input.

Transactions take the existing attendance/scheduling advisory lock before station/device locks. Token validation is repeated after acquiring those locks, preventing a revocation that committed while waiting from allowing attendance. Branch policy, token purpose/version/authenticity/expiry, current station/device credentials, assigned branch, fresh GPS and attendance state are validated before a mutation.

QR location always requires finite coordinates, accuracy and capture time, even if older manual clients still use permissive metadata policy. The branch's existing radius/accuracy/age limits apply. A location whose uncertainty overlaps the boundary requests refinement/correction instead of silently claiming verified presence. This does not eliminate GPS spoofing or QR sharing.

The QR wrapper supplies a private, transaction-scoped operation context to the existing attendance engine. The engine refuses a client-supplied `smart_scan` entry point without that context. The context is cleared before returning. Attendance, token consumption, checkout confirmation and receipts commit together or roll back together. The original shift locks, overnight convention, leave rules, administrator workflows, payroll amounts and manual fallback remain.

Confirmation handles are random UUIDs scoped to the authenticated employee and one session version, with server expiry and single-use completion. They are not general login credentials. Replaying a saved pending-confirmation response updates `serverNow` without extending its expiry. Closing/reopening/editing/deleting the session, moving branch, disabling the feature or revoking its display prevents stale confirmation from mutating attendance.

## API

`GET /api/attendance/smart-scan` returns read-only branch configuration and current attendance. It never records attendance.

`POST /api/attendance/smart-scan` accepts either:

```text
{ action: "scan", token, operationId, location: { lat, lng, accuracy, capturedAt } }
{ action: "confirm", confirmationId, operationId, location: { lat, lng, accuracy, capturedAt } }
```

The caller retains a UUID for an exact retry; changing the payload cannot reuse it. Extra employee IDs, event timestamps or attendance-source labels are ignored. JSON, size, same-origin/public Host/proxy scheme and input validation run before the RPC. Responses are private/no-store and no-referrer. The page cannot be framed and it and the API bypass PWA runtime caching. No URL contains a scanned token and no GET endpoint redeems attendance.

Existing admin push runs after changed attendance succeeds and cannot undo the save; confirmations and receipt replays do not generate completion alerts. Durable intelligent reminders remain the next separate module.

## Android and dependencies

Pinned `@zxing/browser@0.2.1` and its compatible `@zxing/library@0.23.0` decode locally. The scanner is loaded only on the scan screen, with its decoder chunk loaded on camera activation. No paid scanner SDK or native camera plugin is added.

Android **1.2 / version code 3** adds optional camera hardware and CAMERA permission. The WebView forwards only video requests from the configured HTTPS workspace while that workspace is the current page; foreign origins, microphone and unknown/mixed resources are denied. Existing Capacitor runtime permission handling, branding, foreground GPS and feedback are reused.

Debug artifact: `output/android/the-makeup-store-hrm-1.2-smart-scan-debug.apk`, with adjacent SHA-256 file. Package identity stays `in.themakeupstore.hrm`. Older APKs retain manual attendance but need this update for camera access. This wrapper still loads hosted web code: installing the APK alone does not deploy Smart Scan or enable a branch. There is no iOS native project.

## Authorized staging rollout

1. Rehearse migrations on the actual staging base schema/RLS, first using the existing attendance preflight. Apply the new migration after 007; inspect `supabase/checks/smart_scan_preflight.sql` for grants, RLS, function settings and disabled defaults.
2. Deploy matching web code and install Android 1.2 on test phones. Keep live branch flags false. Verify the same HTTPS origin, camera/location grants, actual physical scan distance/lighting, background/Back cleanup, haptics, station revoke/deactivate/move and manual fallback.
3. Enable only the intended staging branch after those checks. Using its real UUID, insert/update `attendance_policies` with `enforce_engine=true, smart_qr_enabled=true`; preserve the other existing policy settings. An absent policy row needs inserting, not only UPDATE. Do not automatically impose a new radius or strictness on manual clients.
4. Test employee/manager/admin permissions, off/leave/overnight/current session behavior, concurrent phones, GPS uncertainty, lost responses and confirmation expiry. Verify actual attendance and append-only audit before requesting production rollout authorization.
5. To withdraw QR attendance, set that branch's `smart_qr_enabled=false` first. Existing confirmations cannot then mutate. Keep engine enforcement, metadata, receipts and audit history; revert web code only as appropriate to the compatible version. Do not drop tables or recalculate paid periods as rollback.

## Verified locally

Production web build, standalone TypeScript and module/integration ESLint pass. All 79 Node tests pass. Real disposable PostgreSQL tests pass 14 Smart Scan scenarios, 25 attendance regressions under the new migration, 12 station regressions and 21 shift regressions. New cases include concurrent scan/confirmation, revocation while waiting for a lock, exact-retry recovery, wrong employee/branch, stale session, expired QR/confirmation, stricter GPS and provenance.

The actual decoder/UI pass 23 synthetic-camera browser checks plus two real employee-home checks. These cover successful scan, explicit confirmation, expiry, stale/denied/offline/unknown-code cases, lost response, permission recovery, track release, hidden/pause/resume, completed/review states, a real 15-second location deadline, and light/dark phone/tablet/desktop layouts. Android compilation, assembly and three workspace/camera unit tests pass; the APK manifest verifies version, optional camera and absence of microphone permission.

Artifacts are in `output/verification/smart-attendance/smart-scan/`. Full-repository lint retains previously documented unrelated failures. Authorization uses the current `profiles.store_id`; temporary/effective-dated assignments and multiple organizations remain unsupported. Physical phone permissions/camera/torch, production RLS/grants, end-to-end latency and fraud resistance remain unverified. No five-second target, live deployment or intelligent reminder/geofencing functionality is claimed.

Additional checks: five local production-server smoke tests passed with external fetch disabled (zero external fetch attempts). npm audit reports the same 30 repository advisories; no newly added scanner/encoder package is flagged and no existing package version was changed. Reference APIs checked: [Supabase functions](https://supabase.com/docs/guides/database/functions), [ZXing browser](https://github.com/zxing-js/browser), [Android WebChromeClient permissions](https://developer.android.com/reference/android/webkit/WebChromeClient#onPermissionRequest(android.webkit.PermissionRequest)).
