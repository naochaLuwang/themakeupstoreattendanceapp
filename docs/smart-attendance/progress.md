# Development progress

**26 November 2026:** Live Main Branch QR attendance is now enabled after finding its missing attendance policy. Hosted scanner API and required checkout columns are present; no migration or web deployment was performed in this session. Zero authorized displays remain, so store-device pairing is required. Home discoverability and admin branch controls are fixed locally and verified; deployment to Hostinger remains pending. See [current Smart Scan status](smart-scan.md#live-configuration-update--26-november-2026). The original module checkpoints below record the earlier development state.

- [x] Read implementation brief and repository instructions.
- [x] Audit web/native architecture and attendance entry paths.
- [x] Record architecture decisions and incremental plan.
- [x] Implement and verify attendance infrastructure (53 Node tests, 25 local database scenarios, 21 shift database regressions, 15 browser checks; build/typecheck/core lint pass).
- [x] Dynamic QR stations (management, pairing, credentials, rotation, recovery, heartbeat and revocation; verified locally).
- [x] Employee Smart Scan (camera, transactional redemption, confirmation, location, fallback and Android camera permission; verified locally).
- [x] Intelligent notifications implemented/verified locally (durable queue, preferences/history, native FCM integration); Firebase configuration, hosted scheduler and physical delivery still pending.
- [ ] Quick access and external QR links.
- [ ] Native geofencing and permission onboarding.
- [ ] Administration/corrections/dashboard.
- [ ] Rollout, physical-device tests and final acceptance.

No production changes have been applied. Continue module by module; pause after each verified module as required by AGENTS.md.

Infrastructure, QR stations and Employee Smart Scan are complete locally. Migrations 006, 007 and `20261124080524_attendance_smart_scan.sql` have not been applied to production. Branch QR flags remain disabled. Notification migration `20261124094512_attendance_reminders.sql` is also local only. Branch reminders remain paused and Firebase is not configured. Next module: quick access/external QR links, after the repository-required module checkpoint. See [notification report](notifications.md) and [Firebase setup](firebase-setup.md).
