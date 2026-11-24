# PWA removal — 24 November 2026

PWA functionality is removed at the user's request. Firebase setup is deferred until requested again.

Removed:

- Next PWA plugin and its build/cache configuration; 264 dependency packages removed with the unused browser-push packages.
- Install banner, install listeners, web manifest and Apple/mobile standalone metadata.
- PWA offline route, precache/fallback bundles and push service-worker implementation.
- Automatic browser recovery/reload scripts and Android's obsolete overrides for them.
- Browser push enrollment, dashboard controls, test-push route, VAPID transport/helper/key settings and browser push provider status. Leave/shift/attendance actions no longer invoke the retired browser transport; their database actions are unchanged.

The online browser workspace, authentication, attendance/QR flows, Store Operations in-app notifications/history, and native Android FCM integration remain. Android retains its approved logo/splash, haptics, camera/location permission handling, file saving, Back/keyboard behavior and native connection-error page. That packaged native connection page is independent of the removed PWA offline route.

## Existing installation cleanup

Keep `public/MUS-SW.js`, its `/sw.js` compatibility rewrite, `components/RetirePwa.tsx` and `lib/browser/retire-pwa.ts` during the migration period. These only retire old installations; they never register a new worker, intercept fetches, cache responses, display pushes or reload pages.

The former worker URLs serve an uncached replacement which activates, removes the app's named caches and unregisters itself. On workspace load, client cleanup unsubscribes/unregisters only this app's known root workers and deletes `navigation-cache`, `start-url` and this origin's root Workbox precache. Unrelated registrations/caches, cookies, local storage, session storage and drafts remain. Browsers can keep an already controlled tab alive until it closes or navigates again; reopening an old tab once after deployment may be necessary. No forced reload discards ongoing forms.

New browser push enrollment is rejected. Historical `webpush` device/job values remain compatible with the existing database schema; the dispatcher terminates those deliveries with `BROWSER_PUSH_REMOVED` without contacting any browser provider. Installation sync revokes its historical browser device. Existing database rows and tables are retained; **no new migration or live data deletion is required**.

## Verification and deployment

Production build, TypeScript, changed-file ESLint, all 95 Node tests, Android debug assembly and its four JVM tests pass. Four dedicated retirement tests cover scoped cleanup, unsubscribe/storage failures and worker self-removal. Five additional screen checks verify browser controls are absent, history/preferences still work, and Android registration remains available when configured. Nine local production/browser smoke checks verify absent PWA metadata/routes, protected pages, public station access, uncached cleanup URLs, no fresh worker registration, real Chromium worker replacement, and storage-preserving client cleanup. Provider and UI checks use fictional local fixtures. Physical Android acceptance is pending.

Artifacts are under `output/verification/pwa-removal/`. The current source removal requires a web deployment to the existing HTTPS host; rebuilding Android alone does not remove the hosted PWA. Rebuild Android after syncing the changed packaged native assets. No deployment or Firebase configuration was performed.

Historical Smart Attendance reports describe earlier browser-push and PWA checks. This document supersedes those statements for current behavior. Future push setup is Android FCM only, with in-app notifications available in browsers.
