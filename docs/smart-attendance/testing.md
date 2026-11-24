# Verification

Run from the repository:

```sh
node --test tests/*.test.mjs
npm run build
npm run typecheck
python3 tests/attendance-engine-database.py --with-smart-scan
python3 tests/shift-lock-database.py
python3 tests/attendance-stations-database.py
python3 tests/attendance-smart-scan-database.py
```

Run build before standalone typecheck, sequentially: Next regenerates its type directory during build.

The four Python suites use only uniquely named disposable databases on PostgreSQL 17, Unix socket `/private/tmp`, port `55439`, owner `audit_owner`. They never read environment credentials or contact Supabase. Supply the local non-login roles `anon`, `authenticated`, `service_role`. Each suite removes only its own fixture database. A local test cluster may be started with TCP disabled; do not point these fixtures at a hosted database.

## Coverage

- Request parsing, legacy/modern inputs, UUIDs, zero coordinates, GPS metadata, ignored timestamp/source injection, session versions and operation ID forwarding.
- Verified authentication, foreign employee denial, one RPC per request, no automatic mutation retry, malformed response rejection and actionable missing-migration failures.
- HTTP JSON/same-host protection, status/error handling and no-store successful responses.
- Existing location acquisition, cancellation, deadline, denied permission and a stricter branch quality setting forcing refinement.
- Existing schedule, native-experience and shift-protection tests; added overnight wall-clock conversion coverage.
- Actual PostgreSQL migration application/rerun, actor/store RLS, anonymous RPC denial, role/geofence protection, strict flag rollout, zero/missing/stale/imprecise GPS, leave/off-day handling, idempotency, completed-shift blocking, exact-session checkout, single-use re-entry, admin merged interval checks, manual preset resolution, immutable audit and policy changes.
- Actual concurrent clock-in and clock-out transactions, rollback when request approval fails, and preservation of conflicting legacy sessions.

The local schema fixture deliberately models only the relevant base tables. It does not prove compatibility with unknown production triggers, grants, constraints or cron definitions. Staging inspection and role-based checks are mandatory before release.

The local browser preview uses actual employee components with fictional data and intercepted HTTP/database calls. It checks swipe/calendar/date independence, manual clock-out during schedule errors, re-entry, disabled duplicates, off/leave and overnight states, future shift-change form, Home navigation and light/dark short-phone fit. It is not a live Supabase or physical Android test.

Core changed files are linted. The three touched legacy admin components already contain unrelated `any`, unused-control and effect-dependency findings; a diagnostic comparison records no new findings. Repository-wide lint also includes generated output and unrelated existing issues. Do not report full-repository lint as passing.

## Still required in later modules

Physical scanner/device permission acceptance, verified deep links, native notification delivery/background behavior, geofencing/battery restrictions, finalized-payroll correction policy, organization/temporary assignment support, real-device end-to-end latency and production-compatible migration rehearsal.

Machine-readable outputs and local test logs are under `output/verification/smart-attendance/`.

## Recorded result (24 November 2026)

Production build, standalone TypeScript, core changed-file ESLint, all 53 Node
tests, 25 attendance database scenarios, 21 existing shift database scenarios
and 15 employee browser checks passed. The three legacy admin components retain
21 existing ESLint errors and three warnings, with no new findings. No physical
Android or production database test was performed.

## Module 3 result (24 November 2026)

Production build, standalone TypeScript, station/integration ESLint and all 68 Node tests pass. Real local PostgreSQL passes 12 station scenarios, 25 attendance engine regressions and 21 shift-lock regressions. Station tests cover migration reruns, RLS/grants, restricted pending devices, single-use pairing, heartbeat, token recovery/idempotency, early-refresh wait, tamper/expiry/branch checks, revocation, stale settings, transactional rollback and concurrent issuance. The base fixture is shared in `tests/attendance_fixture.py`; no production credentials are read.

Actual station components with fictional HTTP/action fixtures pass 22 browser checks covering setup/pairing, rotation, lost-response retry, offline/reconnection, hidden tabs, expiry, revocation, unpairing, missing station, admin create/edit/pair/revoke and responsive light/dark views at 360/768/1280 pixels. The actual SVG screenshot decodes to the exact fictional token using Apple's local Vision barcode detector. This is an image decoding check, not a physical-camera acceptance test. Artifacts and machine-readable results are in `output/verification/smart-attendance/stations/`.

The exact public station path's authentication exception is exercised separately; protected employee/admin and neighboring paths still redirect unsigned users. QR attendance remains disabled; no test claims employee redemption or Android scanning works yet. See [module details](stations.md).

Five local production-server smoke checks additionally confirm signed-out page rendering, no-store/referrer/frame headers, public Host/proxy-scheme origin handling, unauthenticated credential denial, safe already-unpaired reset and GET rejection. These requests use no display or employee credentials and make no database calls.

## Module 4 result (24 November 2026)

Production build, standalone TypeScript, module/integration lint and 79 Node tests pass. Local PostgreSQL passes 14 Smart Scan scenarios and 25 engine regressions **with the Smart Scan migration installed**, plus 12 station and 21 shift regressions. These include employee-specific replay, concurrent issuance redemption/confirmation, revoked devices while waiting for locks, GPS age/precision/uncertainty, exact session binding, provenance, rollback and disabled defaults.

The real ZXing decoder and actual scanner/UI use a synthetic local camera stream and fictional intercepted HTTP responses. All 23 browser checks and two phone home checks pass, including a real 15-second GPS deadline. No real camera or hosted database is accessed. Android assembly/compilation and three workspace/camera tests pass (plus the existing template test); the APK manifest verifies camera permission and app version 1.2/code 3 without microphone permission.

Artifacts: `output/verification/smart-attendance/smart-scan/`. Full details and staging/device limitations: [Smart Scan](smart-scan.md). Branch flags remain off; installing the APK alone does not deploy web or SQL changes.
