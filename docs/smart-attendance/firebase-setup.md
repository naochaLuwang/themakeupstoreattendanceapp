# Android Firebase and reminder worker setup

Updated 24 November 2026 after PWA removal. The supplied Android configuration has been added locally at `android/app/google-services.json` and validated for project **`the-makeup-store-hrm`**, Android package **`in.themakeupstore.hrm`**. It remains ignored by Git. `FCM_PROJECT_ID` is set in local `.env.local`. The user reports Cloud Messaging enabled, the dedicated sender account created, and `FCM_PROJECT_ID` plus `FCM_SERVICE_ACCOUNT_JSON` saved in Hostinger Node.js environment settings. Local server sending credentials remain absent. Firebase cloud access and real delivery have not been verified. After the user’s deployment, unauthenticated live GET checks return HTTP 401 for `/api/notifications` and HTTP 405 for `/api/internal/attendance-reminders/run`, confirming the routes are available and do not run unauthenticated GET work. The user’s Supabase query reports all four prerequisite functions present (attendance engine, stations, Smart Scan and reminders). Function presence does not verify the full schema, grants or real delivery. The user reports `ATTENDANCE_REMINDER_WORKER_SECRET` saved in Hostinger. Scheduling and physical-device testing remain pending. The live domain is now `https://hrm.themakeupstorewangkhei.com`; unauthenticated GET checks on the new domain return the expected 401/405 statuses. Android 1.3.2/code 6 targets this new origin; older APKs target the previous domain. Firebase is used only to transport Android push notifications; existing Supabase authentication, database, storage and application login remain in place. No Firebase Auth or Firestore setup is needed.

## Start here

The Android configuration file is already in place. Continue with **section 2: trusted Next.js server credentials**, then deployment/scheduling and physical-device testing. Use project ID `the-makeup-store-hrm` on the server. The native plugin, Google Services Gradle integration, notification permission and logo-based notification icon already exist in this repository; do not add a second Firebase SDK/plugin setup from a generic tutorial. Section 1 remains as a reference for recreating the configuration.

PWA removal does not change these Android steps. Do not register a Firebase Web app, add VAPID keys, restore a web manifest, or install a browser service worker for this integration. Browser users retain in-app notification history. Continue through server configuration, matching web/database deployment and scheduling before expecting attendance reminders to arrive.

## 1. Create the Android app configuration

1. Create a project in the [Firebase console](https://console.firebase.google.com/). Analytics is optional and is disabled in this Android build.
2. Add an Android application with the existing package ID **`in.themakeupstore.hrm`**. Do not rename the native package or repository. Use the app label **THE MAKEUP STORE HRM**.
3. Download its Android `google-services.json` and place it at **`android/app/google-services.json`**. Keep the filename exact, without a download suffix such as `(1)`. Its Android package must match `in.themakeupstore.hrm`. This file is ignored by Git. Do not substitute a service-account key: that private server key must never enter an APK.
4. Confirm Firebase Cloud Messaging API (HTTP v1) is enabled in the corresponding Google Cloud project. This implementation uses short-lived OAuth authorization, not a legacy FCM server key.
5. Run `npm run android:build` with Node 22+, JDK 21 and Android SDK 36. Gradle applies the existing Google Services plugin when the configuration file is present. Install the rebuilt APK on a device with Google Play services.

Earlier **1.3/code 4 debug APKs were FCM-ready but unconfigured**. The current **1.3.2/code 6** build includes the supplied Android Firebase configuration and targets `https://hrm.themakeupstorewangkhei.com`. It opens the existing hosted workspace; installing it does not deploy these local web/database changes or configure server credentials. The approved launcher/splash logo is retained, with a matching monochrome status-bar notification icon.

Official references: [Capacitor push notifications](https://capacitorjs.com/docs/apis/push-notifications), [Firebase Android setup](https://firebase.google.com/docs/android/setup), and [FCM Android client](https://firebase.google.com/docs/cloud-messaging/android/get-started).

## 2. Configure the trusted Next.js server

Create a dedicated sending service account in the selected project and grant the **Firebase Cloud Messaging API Admin** role (`roles/firebasecloudmessaging.admin`) on the target project. Prefer a deployment identity/ADC where supported; otherwise securely mount a service-account JSON file or store its JSON in the hosting provider's server-side secret manager. Keep private keys outside this repository and do not paste them into chat. Do not grant project Owner/Editor just to send notifications.

Set these server environment values:

| Variable | Value |
| --- | --- |
| `FCM_PROJECT_ID` | The Firebase/Google Cloud project ID, not the Android app ID |
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to a securely mounted service-account file; alternatively use one of the next two modes |
| `FCM_SERVICE_ACCOUNT_JSON` | Optional secret JSON string containing `client_email` and `private_key`; overrides file/ADC credentials |
| `FCM_USE_APPLICATION_DEFAULT` | Set to `true` only when a supported deployment identity is actually configured, instead of a file/JSON secret |
| `ATTENDANCE_REMINDER_WORKER_SECRET` | A randomly generated server-only secret of at least 32 characters, also supplied to the scheduler |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing privileged server key; used by the authenticated worker only |

Use **one** credential mode. Never prefix these private variables with `NEXT_PUBLIC_`. Existing `NEXT_PUBLIC_SUPABASE_URL` and publishable key remain necessary. PWA/browser push and VAPID integration have been removed. Native Android delivery uses FCM after configuration.

For hosting that provides a secret/environment dashboard without mounted credential files, use `FCM_PROJECT_ID` plus `FCM_SERVICE_ACCOUNT_JSON`. Paste the original service-account JSON as the secret value, preserving the JSON escapes inside `private_key`; do not base64-encode it. For a server with a secure mounted file, use `FCM_PROJECT_ID` plus `GOOGLE_APPLICATION_CREDENTIALS` instead. Set the values on the Next.js deployment, not in Capacitor configuration or public web variables. Redeploy/restart the server after adding them. The Android configuration file and server service-account JSON serve different purposes; both must target the intended Firebase project.

The server uses `google-auth-library@10.9.1` to obtain the `firebase.messaging` OAuth scope and sends HTTP v1 messages. See [FCM server authorization and IAM](https://firebase.google.com/docs/cloud-messaging/send/v1-api). Configuration indicators show whether variables exist; a staging send is needed to validate credentials and project/device alignment.

## 3. Deploy schema and worker in authorized staging

1. Inspect the actual base schema, existing notification policies and prerequisite migrations using the read-only preflight scripts. Apply `20261124094512_attendance_reminders.sql` after the Smart Scan migration and prerequisites, through the authorized migration process. All branches default to paused. Deploy the matching Next.js code.
2. Configure an external trusted scheduler to POST once a minute to `https://hrm.themakeupstorewangkhei.com/api/internal/attendance-reminders/run` with `Authorization: Bearer <worker secret>`. The endpoint rejects GET and unconfigured/incorrect credentials.
3. Alternatively, enable Supabase Cron, pg_net and Vault in staging. Add Vault secrets named `attendance_reminder_worker_url` (the HTTPS endpoint above) and `attendance_reminder_worker_secret` (matching the server environment). Review and execute **`supabase/deployment/attendance_reminder_cron.sql`**. This file is not installed by migrations and must not be run against production without authorization. Use only one scheduling mechanism.
4. Confirm the hosting plan permits a 60-second Node route and the intended scheduler frequency. Check scheduler responses, last planning run and queue status. Repeated invocations are safe to retry; no timing guarantee is implied.
5. Sign into a staging employee account in the rebuilt app. In **Profile → Notifications**, choose **Enable attendance push** and grant Android permission. No prompt should appear automatically on launch. Configure a controlled staging shift, enable only that staging branch, and verify history plus foreground/background push delivery. Test a denied permission and sign-out/account switch.
6. Check manager/admin escalation against real branch roles, quiet hours, a shift change, approved leave, clock-in/out before send, token expiry, offline/reconnect, Doze/force-stop, provider outages and worker restarts. Confirm in-app history still works in browsers and Android notification taps open the authenticated app. Browser push and the old browser test-push endpoint have been removed. Only then prepare a separately authorized production rollout.

Supabase scheduling references: [Cron](https://supabase.com/docs/guides/cron), [scheduled function calls with pg_net and Vault](https://supabase.com/docs/guides/functions/schedule-functions).

No Firebase project, service account, scheduler, live enrollment or production migration was created by this implementation. Real FCM delivery is pending this setup and physical-device verification.
