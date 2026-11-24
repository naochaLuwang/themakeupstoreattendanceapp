# Smart attendance implementation plan

## Current delivery boundary

The audit, attendance infrastructure, dynamic QR stations and Employee Smart Scan have been implemented and verified locally. Next is Intelligent notifications. `AGENTS.md` requires a pause after each implemented module. No production migration, deployment or live-data mutation is authorized by this brief.

## Repository assessment

- Next.js App Router, React 19, TypeScript, Supabase cookie authentication, PostgREST and Realtime. The project does not contain the original base-schema migration or its RLS policies.
- Android uses Capacitor 8 as an online HTTPS wrapper. Existing local native integration supplies launch branding, feedback, back handling, keyboard/system bars, offline UI, geolocation permission and file downloads. There is no iOS project, native camera scanner, native geofence registration, FCM registration, or background-location permission.
- `profiles.store_id` is the branch assignment; `stores` holds coordinates and radius. There is no organization entity or effective-dated temporary branch assignment. Do not invent tenant isolation or temporary assignments that are not implemented.
- Manual employee attendance is duplicated between two API routes and `app/actions/attendance.ts`. Those implementations perform separate active-session reads and writes, trust submitted branch/shift IDs, ignore some read failures, and do not validate GPS age/accuracy server-side.
- Admin manual entries/edits/deletes use a service client, with browser paths separately reopening, closing or even deleting attendance. Re-entry request approval is not atomic or single-use. These paths need one service and transaction boundary.
- Attendance remains in the existing `attendance` table. Actual events are timestamps; existing schedules encode displayed wall-clock dates/hours in their UTC components. Keep that schedule convention, convert it explicitly when resolving windows, and preserve payroll calculations.
- Migration 005 permanently locks worked shifts and serializes schedule changes with attendance association. New transactions must use the same lock order and retain those protections. Overnight clock-in after midnight currently conflicts with its same-business-day association check.
- Approved leave is in `leave_requests`; off days are dates without a shift. There is no break/segment policy or explicit split-shift policy. Completed attendance must remain completed until the existing authorized re-entry flow acts.
- Payroll reads attendance and stores paid settlements in `payroll_records`. No finalization-lock service exists in this repository. Never recalculate or overwrite existing settlements in this module; document historical-edit impact and the later correction/period-lock integration.
- Existing VAPID web push targets admins; operations have an independent notifications table. The service worker opens URLs. There is no durable reminder queue, worker scheduler, per-device native token service, notification preferences or geofence engine.
- Existing tests cover location acquisition, shift locks and native compatibility. A disposable local PostgreSQL fixture can validate migrations and real concurrency without production access.

## Sequence

1. **Repository audit**: inventory paths, conflicts, policy compatibility, missing infrastructure and rollout constraints.
2. **Attendance infrastructure**: shared typed server service, compatible API/action adapters, authenticated transactional RPC, idempotency, exact-session/version clock-out, branch/shift/leave/location checks, auditable admin operations, append-only audit and staged direct-write enforcement. Preserve the employee design and manual fallback.
3. **Dynamic QR stations**: branch-scoped pairing, station credentials/revocation, secure rotating tokens, station heartbeat/display/management. QR flags remain off until this module works.
4. **Employee Smart Scan**: scanner and permission flow, token redemption, duplicate suppression, clock-out confirmation, fresh location, fallback and realtime dashboard updates.
5. **Intelligent notifications**: device registration, durable scheduling, deduplication, delivery retries and manager escalation, extending current infrastructure.
6. **Quick access**: safe authenticated notification actions, Android shortcuts, verified links and browser external-camera fallback. URLs alone never mutate attendance.
7. **Native geofencing**: explicit optional permission onboarding, OS geofences and reminder filtering; scheduled fallback where unsupported. No browser polling presented as native monitoring.
8. **Administration**: settings UI, corrections with evidence/reasons/approval and payroll-lock checks, audit history and attendance dashboard extensions.
9. **Rollout**: integration/security/device testing, staging migration, feature enablement, measured performance and rollback rehearsal.

## Decisions

- Use the existing Supabase/PostgreSQL transaction boundary and typed server client. Do not add a second database or client-side attendance toggle.
- Public RPC wrappers are invokers. Their non-exposed implementation must explicitly authenticate and authorize every operation; privileged code has fixed empty search paths and explicit execution grants.
- Keep current branch radius (100m fallback), geofence-free manual clock-out and permissive early/late recording. Do not silently switch live stores to the suggested 50m radius or introduce late/early payroll rules.
- New clients send location accuracy/capture time and an operation UUID. Older API/action signatures remain accepted, with documented limits for missing metadata and session versions.
- Add metadata and tables without rewriting recorded hours or deleting legacy duplicates. Detect ambiguous active rows and require reconciliation instead of closing/discarding several sessions.
- Stage enforcement separately: migrations initially audit legacy writes; per-branch direct-write enforcement is enabled only after compatible server adapters are deployed and tested.
- Future sources such as QR cannot be enabled just by passing a source string to the manual endpoint.

## External dependencies and unresolved evidence

Production base RLS, grants, existing SQL functions/triggers, actual constraints and schema drift require an authorized staging/live schema inspection before deployment. No connected Supabase tool is available. This does not prevent local implementation or disposable-database tests.

QR, native notifications and geofencing will require later modules and possibly new Android builds, permissions and release configuration. Their behavior cannot be declared tested on a real device from this workspace alone.

Official references checked: [database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [changelog](https://supabase.com/changelog.md). No hosted CLI command is needed for this delivery.
