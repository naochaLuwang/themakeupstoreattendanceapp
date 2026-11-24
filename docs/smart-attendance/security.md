# Security assessment and controls

Implemented and locally exercised: verified user identity; database role/branch checks; exact shift ownership; leave/off-day rejection; no silent second attendance after completion; single active session on new writes; operation payload binding; exact-session/version checkout; single-use re-entry approval with rollback; server timestamps; finite/ranged coordinates and interval validation; age/accuracy checks; privileged-field guards; explicit RPC execution grants; per-table RLS; immutable audit; JSON/same-host API submission checks; failure responses without internal database detail.

Privileged database implementation is intentional: it is an atomic security boundary, not a workaround for RLS errors. It validates the signed-in actor independently of client profile claims, lives outside exposed schemas, pins search paths, and denies anonymous execution. Do not grant its helper functions publicly or let employees write operation receipts.

Successful receipts store the original response, including existing attendance geotags, under creator-only access. Audit snapshots omit raw latitude/longitude. No continuous location collection, device fingerprint or background permission is added. Define organization-approved receipt/audit retention before broad rollout; no destructive purge is scheduled by this module. Database owners and trusted maintenance roles remain privileged and must be controlled operationally.

## Important remaining limitations

- Until staged direct-write enforcement is enabled, older direct-write permissions retain their known limitations. Apply and validate the deployment sequence, not just the SQL file.
- Missing GPS metadata/session binding is tolerated for older clients. Strict modes close those compatibility gaps after migration.
- GPS is device-supplied evidence. Age/accuracy bounds and a branch radius do not prove a physical person is present or eliminate location spoofing.
- The real base RLS, grants, original cron function and profile creation triggers are not in this repository. The preflight must review them on authorized staging infrastructure before production.
- Existing payroll save code lacks an explicit application role check, relying on unknown base RLS; this is an existing broader audit finding, not fixed by the attendance engine. Existing paid amounts are unchanged. Do not claim finalized-period correction protection until module 8 implements and verifies it against the real payroll policy.
- Historical admin input remains on its existing explicit UTC contract. A future correction UI must make the store-time interpretation explicit rather than silently reinterpret old input.
- QR stations now implement token authenticity, branch binding, expiry and credential revocation locally; see [station security](stations.md). Employee redemption/replay protection is now implemented locally in Smart Scan. Native device tokens and background geofences remain outstanding. Branch QR flags are still disabled.

References checked: [Supabase functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [observability](https://supabase.com/docs/guides/observability).

## Station capability boundary

The exact public station display route and anonymous credential-protected device RPC are deliberate exceptions to user-session-only access. They expose no employee identity or attendance mutation. Admin management and read-only token verification retain authenticated authorization. Cookie, hashing, grants, revocation, replay boundary and tested limitations are specified in [stations.md](stations.md).

## Smart Scan verification boundary

[Smart Scan](smart-scan.md) adds authenticated per-employee redemption, transaction-scoped engine context and session/version-bound confirmation with fresh GPS. Private receipt/attempt tables deny all client table access. Origin checks account for the public Host/proxy scheme. Camera frames decode locally; Android video permission is restricted to the current configured HTTPS workspace, denying microphone/unknown resources. QR flags require engine enforcement and remain false until authorized staging/device verification.
