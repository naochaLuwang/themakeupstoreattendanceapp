# Setup, deployment and rollback

## Attendance infrastructure delivery

No dependency or environment variable is added. Existing server Supabase URL/publishable key and verified cookie sessions are reused. Attendance no longer needs a service-role client for its admin commands. Other existing modules still have their original environment requirements. Admin push remains optional through existing VAPID variables.

No production migration or deployment has been performed. Do not deploy the new adapters before the RPC exists.

## Authorized staging rollout

1. Review `supabase/checks/attendance_preflight.sql` on a staging clone with the actual base schema, policies, grants and original functions. Verify profile authorization fields and branch settings; inspect old `manual_trigger_checkout` authorization and existing constraints. Count legacy duplicate active records and review interval exceptions without deleting them.
2. Rehearse backup and web rollback. Test under real employee/admin/manager sessions and the current Android wrapper. The local fixture is not a copy of production.
3. Apply migration 005, then 006 through the authorized migration process. Do not rerun unrelated operations migrations. 006 adds metadata, tables, indexes, guards and the RPC; it preserves existing attendance/paid settlement values.
4. Keep new per-store enforcement/strict flags off while the old server code is in service. Legacy writes are still audited. Deploy the compatible Next.js adapters and employee state consumer atomically.
5. Test old request bodies, modern versioned bodies, GPS/leave/shift checks, admin manual edit/delete/force checkout and re-entry. Confirm old browser/client interfaces still operate with the selected compatibility policy.
6. As an authorized admin, insert a policy row for each intended branch using its real UUID, then enable `enforce_engine`. Default radius remains in `stores.radius_meters`; changing it is an explicit management policy decision. Enable `require_location_metadata` and `require_session_binding` once the participating clients support those fields. Inspect policy-change and attendance audit events.
7. Verify anonymous and cross-store denial, direct-write enforcement and actual concurrent requests in staging. Then request explicit production authorization. The APK loads the hosted app; web deployment is required separately from rebuilding Android.

Strict flags intentionally change what older clients must provide. Do not enable them without compatibility verification or present the permissive transition window as fully enforced security.

## Rollback

Disable strict/enforcement flags through an authorized admin before reverting to old server adapters that write attendance directly. Revert web code to the last verified release, retaining the additive metadata, receipts and audit history. Do not drop columns/tables or delete records as an automatic rollback. Investigate any security impact before leaving legacy writes enabled.

For a database-function rollback, have a DBA review triggers and dependent functions on the staging clone; the overnight extension and 005 permanent locks must remain consistent. Restoring the whole database from an earlier backup would lose subsequent legitimate attendance and is not a routine application rollback.

## Native work still outstanding

The Android wrapper currently provides foreground location permission, native feedback, file saving, Back/keyboard behavior and a local launch screen. This delivery adds no native dependency, camera/background permission or background tracking.

Later modules must implement and test camera scanning; verified links/assetlinks and Android shortcuts; native device notification registration/actions; and optional OS geofences with transparent foreground/background permission onboarding, dwell/cooldown filtering and scheduled fallback. There is no iOS project. No native behavior can be declared tested while only browser/local database tests have run.

## Module 3 staging and rollback

After validating 005/006 against the real base schema, apply 007 and deploy its matching web code. The only new runtime dependency is the local QR encoder `qrcode@1.5.4`; `@types/qrcode@1.5.6` is development-only. No new secret, native dependency or Android permission is required. Pair a display on HTTPS while signed out and verify cookie security, page/API no-store headers, PWA recovery and role denials before rollout. Keep `smart_qr_enabled` false: employee redemption is the next module.

To withdraw the station module, revoke/deactivate stations through the admin flow before reverting the web code. Retain additive station tables and audit history; no destructive rollback SQL is provided. The previous native APK still loads hosted web code, so local edits alone do not update it. See [station setup](stations.md).

## Module 4 staging and rollback

Apply `20261124080524_attendance_smart_scan.sql` after 007 through the authorized staging process, then deploy matching web code and install Android 1.2. New pinned dependencies are ZXing browser 0.2.1/library 0.23.0; no new secret or paid provider is required. Camera permission is new, optional and foreground-only; no microphone or background location permission is introduced.

Keep branch flags false until physical/staging checks pass. Opt-in requires both `enforce_engine=true` and `smart_qr_enabled=true` on the intended policy row. Turning `smart_qr_enabled=false` withdraws QR actions/confirmations without changing manual attendance or deleting receipts/audit. Full instructions, APK location and remaining checks: [smart-scan.md](smart-scan.md).
