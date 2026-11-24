# Dynamic QR stations — module 3

Implemented locally on 24 November 2026. This module prepares authorized branch displays. Employee QR attendance remains disabled until module 4 implements atomic redemption, per-employee replay protection, location checks and clock-out confirmation. Migration 006's `smart_qr_enabled` constraint remains unchanged and false.

## Setup after authorized staging installation

1. Apply `supabase/migrations/007_attendance_stations.sql` after migrations 005 and 006, then deploy matching web code. No new environment secrets, paid service or Android permission is required.
2. As an administrator, open **Attendance stations** (under More on mobile). Create a station, select its real branch and name it. Multiple stations per branch are supported.
3. Open its display link on the store computer/tablet and choose **Authorize display**. The URL contains only a station UUID.
4. Verify the displayed eight-character code in person. Enter it and a display name in administration within five minutes. Approval consumes the code.
5. The display detects approval and shows rotating QR codes, expiry, connection status and existing branding. It does not need an administrator signed in. Full-screen controls appear only where supported.
6. Monitor displays, last heartbeat, connectivity and total codes issued. The counter measures QR issuance, not employee attendance or scans.

Defaults: refresh 30 seconds, validity 45 seconds, heartbeat 15 seconds, offline threshold 60 seconds, new device authorization 90 days. Settings require at least five seconds of validity overlap and an offline threshold at least twice the heartbeat interval. Shorter validity applies to newly issued codes; authorization duration applies to subsequently approved devices.

One browser profile holds one station credential. Use separate profiles/devices for different stations. Clearing cookies requires reauthorization. Revocation, deactivation and moving branches invalidate outstanding codes on server verification. Reactivation never restores revoked displays. Deactivation retains station history instead of deleting it.

## Schema and authorization

Migration 007 is additive and rerunnable. All four new tables have UUID IDs, `created_at`, `updated_at`, `created_by` and RLS.

| Relation | Purpose | Client access |
| --- | --- | --- |
| `public.attendance_stations` | Branch/configuration, active state, usage counters | Admin SELECT; admin RPC mutations |
| `public.attendance_station_devices` | Pairing, approval, expiry, revocation, heartbeat metadata | Admin SELECT; constrained RPC mutations |
| `hrm_private.attendance_station_keys` | Credential and pairing SHA-256 digests | No client table grants |
| `hrm_private.attendance_station_tokens` | Purpose, token UUID, station/device/branch binding, MAC digest, expiry and request UUID | No client table grants |

Admin commands independently check the authenticated profile role inside PostgreSQL. Managers/employees cannot manage stations. Anonymous users cannot execute management or token verification. Authenticated admin/token-verification wrappers use SECURITY INVOKER. The public device RPC is an intentionally narrow SECURITY DEFINER capability boundary, explicitly granted to anonymous/authenticated callers because displays have no user session. Both wrapper and implementation pin empty search paths; the private device implementation has no client EXECUTE grant. No anonymous private-schema access is added.

Append-only attendance audit events gain a nullable `station_id`. Creation, edits, approval requests/approvals, revocation and unpairing are recorded. Migration 007 does not change attendance records, schedules, payroll settlements or employee interfaces.

## Credential and QR protocol

- Node generates a random 256-bit credential, carried only in an HttpOnly, Secure-in-production, SameSite=Strict cookie scoped to `/api/attendance/station`. It is absent from JSON, URLs and local storage. Production pairing requires HTTPS.
- A purpose-separated HMAC derives the eight-character Crockford pairing code, permitting recovery after a lost response. Only its digest is stored, with a five-minute expiry, and approval clears it. At most five live pending requests are allowed per station; admins can revoke unwanted requests.
- Node derives an HMAC-SHA-256 for each issuance request UUID. PostgreSQL stores its SHA-256 digest and generates a separate token UUID. Payload: `hrm.attendance.v1.<server-token-UUID>.<base64url-MAC>`.
- QR payloads contain no employee identity, device credential or pairing code. `qrcode@1.5.4` encodes locally into a square SVG with a four-module white quiet zone. No external QR service receives tokens. `@types/qrcode@1.5.6` is development-only.
- Issuance and management lock station before device. Retrying one request UUID/digest returns the same unexpired code. Early refresh returns only the remaining wait, avoiding a full-interval pause. Status/heartbeat returns latest unexpired token metadata for Node to reconstruct a QR after reload or a lost response.
- A device's expired token material older than 24 hours is pruned on its next issuance. Inactive devices' material remains until an authorized retention process is established. Counters and audit history remain. Separate server-generated token UUIDs prevent reuse of pruned client request UUIDs from reviving old exact codes.
- Read-only `attendance_station_token_status` validates format/version/purpose, digest, server expiry, authenticated assigned branch, active station and current device authorization. Multiple employees can verify a valid code. **It does not consume tokens or record attendance.** No employee scanner or public QR attendance mutation endpoint is exposed in this module.

## HTTP and display behavior

`POST /api/attendance/station/{start,status,heartbeat,issue,forget}` accepts JSON `{stationId}`; issue also requires `{requestId}`. Foreign origins (including a different scheme), oversized bodies, invalid UUIDs and unsupported actions are rejected. Responses are private/no-store, no-referrer and nosniff. Start creates only a pending display; approval requires an admin. Forget derives the actual bound station from its credential and clears its cookie after revocation. Failed revocation never claims success or discards the credential needed to retry.

Only the exact public `/attendance-station` path bypasses the user-session login redirect. Administration/employee routes retain authentication. The origin guard uses the browser-facing Host and proxy scheme, accommodating Next internal URL reconstruction while rejecting other origins. The page exposes no employee/approver IDs, payroll or admin controls, cannot be framed, excludes indexing and uses NetworkOnly PWA caching. Install prompts are suppressed on it.

Monotonic countdowns subtract the full HTTP round trip from server validity. Expired, offline and hidden codes are cleared. Reconnection reloads current status. Lost issuance retries retain their UUID. Revoked/invalid credentials stop automatic retries and require explicit authorization. Admin settings carry `expectedUpdatedAt`; stale forms cannot overwrite newer settings and explain how to reopen them.

## Verification and limitations

Passed: production build, standalone TypeScript, station/integration ESLint, 68 Node tests, 12 station database scenarios, 25 attendance database regressions and 21 shift-lock regressions. Browser fixtures passed 22 checks: pairing, rotation, lost response, offline/hidden-tab recovery, revocation/unpairing, management forms and 360/768/1280-pixel light/dark layouts. Apple's local barcode detector decoded the actual SVG screenshot to the exact fictional token. Five additional local production-server checks passed for signed-out rendering, actual headers, same-origin/foreign-origin handling, missing-credential denial, unpair reset and GET rejection. Artifacts: `output/verification/smart-attendance/stations/`.

These tests use fictional local records, not a production Supabase clone. Unknown production grants/triggers, deployment headers/cookies and the Android wrapper require authorized staging checks. Physical camera distance/low light, scanner permissions and end-to-end attendance latency remain untested. QR sharing and device-supplied GPS cannot be described as eliminating fraud.

Full-repository ESLint retains previously documented unrelated failures. npm audit reports 30 repository advisories; none names the new encoder/type packages or their newly introduced dependencies. Unrelated package upgrades were not attempted.

No hosted migration or deployment was performed. The next module is **Employee Smart Scan**, including atomic per-employee redemption and the shared attendance engine. Do not enable QR attendance before it is complete and verified.

## Module 4 update

Employee Smart Scan is now implemented locally; see [its report](smart-scan.md). The new migration follows 007 and permits per-branch QR opt-in only with engine enforcement. Defaults remain off, so displays still show setup mode until that branch is enabled after staging verification. The module 3 verification above records its original delivery boundary.
