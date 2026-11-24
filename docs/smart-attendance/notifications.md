# Intelligent attendance notifications — module 5

Implemented and verified locally on 24 November 2026. No Firebase project exists yet. No hosted migration, web deployment, scheduler installation or real notification send was performed. All branches start with scheduled reminders disabled.

## Delivered behavior

The server plans reminders independently of an open app. Notifications never clock someone in/out or alter attendance, schedules, payroll or approvals. Opening a notification takes the user to the authenticated app, where current permissions and attendance rules still apply.

| Event | Default timing | Recipient and eligibility |
| --- | --- | --- |
| Upcoming shift | 15 minutes before start | Assigned employee, unless attendance has started |
| Missed clock-in | 5 minutes after start | Assigned employee without attendance |
| Late attendance review | 30 minutes after start | Current branch managers and admins |
| Shift ending | 5 minutes before finish | Employee with an active matching session |
| Missed clock-out | 15 minutes after finish | Employee with an active matching session |
| Unresolved session review | 60 minutes after finish | Current branch managers and admins |
| Re-entry approved | After a successful engine approval | Employee; sourced from the actual immutable successful operation |

Admins configure branch timing at `/admin/attendance-notifications`. Employees manage device enrollment, event preferences, India-time quiet hours and private history at `/employee/notifications`, linked from Profile. Managers/admins can opt out of review alerts. Reminders default to a 30-minute validity window and 15-minute cooldown per employee/recipient. Approved leave and off days suppress reminders. Shift snapshots and current attendance are rechecked before publication and again immediately before transport, including cancelled/moved shifts and clock-in/out after claiming.

The existing notification history component and recipient-filtered Realtime subscription are reused. When the Supabase Realtime publication exists, the migration adds the history table idempotently. Verify publication/subscription delivery in staging; the disposable fixture checks publication membership, not the hosted Realtime service. PWA/browser push and its immediate administrator VAPID alert path were subsequently removed at the user’s request. Store Operations in-app history and native Android FCM integration remain. Firebase setup is deferred. Geofence events, new correction workflows and actionable notification buttons belong to later modules.

## Schema and access

Apply `20261124094512_attendance_reminders.sql` after `20261124080524_attendance_smart_scan.sql` and its prerequisites. The migration is additive and rerunnable; every new table has UUID `id`, `created_at`, `updated_at` and `created_by`.

| Relation | Purpose and access |
| --- | --- |
| `public.attendance_reminder_settings` | Unique branch timing/configuration; admin reads and validated admin RPC writes |
| `public.attendance_notification_preferences` | Unique user preferences; own reads and validated RPC writes |
| `public.attendance_notification_devices` | Own device metadata, enabled/revoked state, last activity; no raw credential reads |
| `hrm_private.attendance_notification_keys` | Hash of installation cookie, unique credential hash, transport credential, revision; no client table grants |
| `hrm_private.attendance_reminder_jobs` | Unique schedule/event/recipient jobs with expiry and suppression state; worker only |
| `hrm_private.attendance_push_deliveries` | Per-job/device attempts, leases, retries and outcomes; worker only |

Existing `notification_log` gains reminder/store/review identity and standard update/creator metadata. Legacy records are retained. A restrictive RLS policy protects the new engine rows even if the old permissive operations policies exist: only the recipient can read them, and manager review messages additionally require current branch authority. Clients can acknowledge an authorized message as read, but cannot forge, rewrite or delete engine history. This does not claim to repair every legacy operations policy.

Public invoker RPCs wrap private fixed-search-path implementations: `attendance_notification_user`, `attendance_reminder_admin` and service-role-only `attendance_reminder_worker`. User HTTP mutations require same origin, authenticated user binding and validation; raw installation secrets come only from the HttpOnly cookie. Worker HTTP requires a separate constant-time-checked bearer secret before creating a privileged client.

## Device lifecycle and privacy

- Native permission requests happen only after **Enable attendance push**. Missing Firebase configuration is displayed explicitly; no registration or permission request is attempted in this state.
- A 256-bit HttpOnly installation cookie is stored only as a hash in the database. FCM tokens and retained historical browser subscriptions remain in the private schema, accessible to the transport worker; they are not end-to-end encrypted. Protect database backups and service credentials accordingly.
- Credentials are unique. A different installation cannot take over a live token. Account switching revokes the previous device metadata and creates separate metadata for the new account, disabled until explicit enrollment. Creator IDs/names are not carried into the new account. Sign-out best-effort detaches the current installation.
- Up to ten fresh active devices per user; devices without activity for 30 days are ineligible. Token rotation changes the credential revision; an expired old token cannot disable its replacement. OS permission revocation is reconciled on resume/settings.
- Lock-screen payloads are generic and omit employee names, shift details and branch information. Provider-accepted notifications cannot be recalled on logout or a last-moment attendance change. The authenticated destination and generic body limit disclosure. There is a small unavoidable race after the final database check and before provider acceptance.
- New browser push registrations are rejected. Existing queued browser deliveries terminate with `BROWSER_PUSH_REMOVED` without outbound requests; the lifecycle bridge revokes this installation’s historical browser device on sync. Database tables/history are retained.
- Push URL routing is restricted to internal employee/admin screens, without external redirects or attendance mutation endpoints. Existing internal query parameters are retained for legacy links. No token, endpoint, provider error body or service credential is logged.

## Delivery guarantees and operation

The worker plans and claims jobs using database transactions, unique keys, advisory cooldown locks and `SKIP LOCKED`. Publication/history and per-device attempt creation are atomic. Network sends happen outside database locks, in batches of at most 12 with concurrency three. Each attempt has a three-minute fenced lease. Interrupted attempts can be reclaimed; stale workers cannot acknowledge a replacement lease.

Transient provider errors retry with bounded backoff, up to five attempts within the reminder validity window. Missing/invalid provider configuration defers attempts for 15 minutes without consuming the retry budget. Invalid current registrations disable only that device. Quiet hours/cooldowns defer work only while it remains relevant. Configuration changes cause pending work to be reevaluated.

History is deduplicated, but transport is **at least once**: a provider can accept a send before an acknowledgement is lost, allowing a later retry. Collapse keys/tags reduce repeated visible notifications. “Push requests accepted” means provider HTTP acceptance, not proof of display, reading or exactly-on-time delivery. Android battery restrictions, offline devices, force-stop, permissions and normal-priority FCM delivery can delay or prevent display. There is no exact alarm or background location tracking.

The worker is invoked through `POST /api/internal/attendance-reminders/run`. The optional reviewed setup file `supabase/deployment/attendance_reminder_cron.sql` uses Supabase Cron, pg_net and Vault once a minute. It is deliberately separate from migrations. No schedule is automatically created. An equivalent trusted scheduler can call the same authenticated endpoint. Check host duration limits, database latency and queue volume before increasing traffic; each invocation handles a bounded batch.

Use `supabase/checks/attendance_reminders_preflight.sql` to review grants, RLS, functions, settings and queue counts without exposing credentials. Monitor last planning run, provider acceptance/errors, expired jobs, lease recovery and scheduler failures. Provider configuration indicators only detect the presence of settings, not successful authentication. Establish an authorized retention policy for old private device keys, jobs, delivery attempts and history before production; no historical cleanup is installed automatically.

## Setup, rollback and verification

Follow [Firebase and worker setup](firebase-setup.md). Keep branch settings paused while rehearsing against the real staging schema and authenticated employee/manager/admin accounts. Local fixtures are not a copy of production; Supabase security/performance advisors and hosted compatibility checks have not been run.

To withdraw delivery, pause branch reminder settings and remove only the `hrm-attendance-reminders` schedule. Stop any external worker invocations before reverting web code. Disable registrations/revoke server credentials as appropriate. Retain additive tables and history; do not drop attendance data. Already accepted provider messages may still arrive before TTL expiry. Attendance remains independent of notification transport.

Historical module-5 verification (before PWA removal): production build and TypeScript pass; all changed module/integration files pass ESLint. All 94 Node tests pass, including 15 notification tests. Real disposable PostgreSQL passes 18 notification scenarios and 72 existing attendance/scan/station/shift scenarios; the core engine suite runs with the new migration installed. Fifteen browser fixture checks cover real components, explicit permissions, an unconfigured Android build, preferences, devices, account mismatch, history errors, stale admin editing and light/dark responsive layouts. Android debug assembly and four JVM tests pass. The APK manifest contains notification permission and the logo-derived notification icon; Firebase remains unconfigured. Provider requests are mocked; real Android background delivery and Firebase credentials are untested. See [verification](testing.md) and artifacts in `output/verification/smart-attendance/reminders/`.

Module 5 stops at the repository-required checkpoint. The next implementation module is quick access/external QR links and related interactive entry points, not geofencing.

Current verification after removing browser push/PWA is recorded in [PWA removal](../pwa-removal.md).
