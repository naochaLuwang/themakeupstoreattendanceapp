## Attendance infrastructure update

The attendance adapters require migrations **005 and 006**, QR stations additionally require **007**, and Employee Smart Scan requires **20261124080524_attendance_smart_scan.sql**, before deploying matching web code. Migration 006 adds the centralized attendance engine, audit trail and per-store staged enforcement. Rehearse on the real staging schema first; no production migration or deployment has been performed.

Start with [the implementation report](docs/smart-attendance/implementation-report.md), [rollout and rollback](docs/smart-attendance/platform-setup.md), and [progress checklist](docs/smart-attendance/progress.md). [QR stations](docs/smart-attendance/stations.md) and [Employee Smart Scan](docs/smart-attendance/smart-scan.md) are implemented locally. Branch QR flags remain off pending staging/device checks. Intelligent reminders remain the next module.

<a href="https://demo-nextjs-with-supabase.vercel.app/">
  <img alt="Next.js and Supabase Starter Kit - the fastest way to build apps with Next.js and Supabase" src="https://demo-nextjs-with-supabase.vercel.app/opengraph-image.png">
  <h1 align="center">Next.js and Supabase Starter Kit</h1>
</a>

<p align="center">
 The fastest way to build apps with Next.js and Supabase
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#demo"><strong>Demo</strong></a> ·
  <a href="#deploy-to-vercel"><strong>Deploy to Vercel</strong></a> ·
  <a href="#clone-and-run-locally"><strong>Clone and run locally</strong></a> ·
  <a href="#feedback-and-issues"><strong>Feedback and issues</strong></a>
  <a href="#more-supabase-examples"><strong>More Examples</strong></a>
</p>
<br/>

## Features

- Works across the entire [Next.js](https://nextjs.org) stack
  - App Router
  - Pages Router
  - Proxy
  - Client
  - Server
  - It just works!
- supabase-ssr. A package to configure Supabase Auth to use cookies
- Password-based authentication block installed via the [Supabase UI Library](https://supabase.com/ui/docs/nextjs/password-based-auth)
- Styling with [Tailwind CSS](https://tailwindcss.com)
- Components with [shadcn/ui](https://ui.shadcn.com/)
- Optional deployment with [Supabase Vercel Integration and Vercel deploy](#deploy-your-own)
  - Environment variables automatically assigned to Vercel project

## Display branding

The sign-in screen, admin and employee workspaces, and browser titles display **THE MAKEUP STORE HRM**. Shared display branding lives in `lib/branding.ts` and `components/AppBrand.tsx`; the approved logo is `public/branding/the-makeup-store-hrm.png`. The project identity, installed-app names, and business name on payroll documents are retained.

## Android app (Capacitor)

The Android package uses the approved HRM logo for its launcher and splash screen, and opens `https://attendance.themakeupstorewangkhei.com`. Its Android application ID is `in.themakeupstore.hrm`. The repository name and existing web/PWA identity are retained.

This first Android build is an online wrapper: login, API routes, Server Actions, and Supabase access continue through the hosted Next.js app. Web changes must be deployed to that host separately. A bundled connection-error page provides a retry action; it does not save attendance offline. Location permissions are requested when the existing clock-in flow needs them. PDF/CSV downloads use Android's document picker, without broad storage access.

Android version **1.1** adds a native animated launch screen using the approved logo, system haptics, keyboard-aware navigation, theme-matched system bars, native connection feedback and Android Back behavior. Most affordances are packaged in the APK; explicit attendance feedback/background refresh changes also have web source updates. See [Android experience notes](docs/android-experience.txt) and the [animated design preview](output/mobile/native-splash-preview.html).

Requirements: Node.js 22+, JDK 21, and the Android SDK with platform/build tools 36. The scripts detect the usual macOS SDK and Homebrew JDK 21 locations; otherwise set `ANDROID_HOME` and `JAVA_HOME`.

```bash
npm install
npm run android:build   # Generate assets, sync Capacitor, and build the installable debug APK
npm run android:open    # Open the native project in Android Studio
npm run android:run     # Run on an attached Android device or emulator
```

The APK and SHA-256 checksum are written to `output/android/`. The APK uses the local Android debug certificate and is intended for internal testing. `npm run android:bundle` builds an unsigned release bundle; public distribution requires a release signing key. Signing keys and generated build assets are ignored by Git.

Change the host in `mobile/app.json`, or set `CAPACITOR_SERVER_URL` to another trusted HTTPS origin before syncing/building. `npm run android:assets` regenerates Android artwork from `public/branding/the-makeup-store-hrm.png`. Only Android is included in this phase. Native push notifications require separate Firebase setup; the current package does not configure FCM.

Capacitor documents [`server.url`](https://capacitorjs.com/docs/config) for live reload. This package deliberately uses a single HTTPS host as an internal web wrapper; review that architecture and release signing before public store distribution. See the official [Android workflow](https://capacitorjs.com/docs/android) and [asset generation guide](https://capacitorjs.com/docs/guides/splash-screens-and-icons).

## Color theme

Use the sun/moon icon on the sign-in page or in the workspace navigation to switch between light and dark themes. Admins can find it in the sidebar on desktop and the **More** menu on mobile. Employees can use the workspace header on mobile and the navigation bar on desktop. The control's tooltip and accessible label describe the theme it switches to.

The app follows the device theme until a selection is made. The selection is saved in this browser and synced across open tabs. The shared provider in `components/ThemeProvider.tsx` uses the existing `next-themes` dependency; workspace colors remain in `components/workspace.css`. No database changes are required.

## Swipe attendance

Worked-shift protection is implemented in migration `005_shift_attendance_lock.sql` and the shared scheduling actions. It locks ordinary schedule changes after attendance starts, preserves the lock after checkout, and applies exchanges/publications atomically. Apply the migration before deploying these web changes. See [shift-locking documentation](docs/shift-locking.txt) for schema details, compatibility, validation and deployment order.

On **My shifts**, drag the arrow to the right edge and release to clock in or out. Taps and incomplete swipes do not submit. Keyboard and screen reader users can activate the arrow to confirm. The control stays locked while a request is in progress, and completion is shown after the server confirms attendance.

Clock-in first checks a recent location (up to 15 seconds old) with a four-second acquisition timeout. If that fix is unavailable, inaccurate, or outside the store area, it requests fresh, high-accuracy updates for up to 21 more seconds. Tracking stops after a usable fix, failure, or navigation away. Location errors remain visible with recovery instructions. The existing server geofence remains in force; clock-out does not request location. Browser permissions and the device's location services must still be enabled.

Attendance days use `Asia/Kolkata`. Existing attendance endpoints, the re-entry approval flow, and database schema are retained. An active employee can clock out even while viewing another date or a pending shift-change request.

Run the location and date regression checks with `node --test tests/attendance-location.test.mjs`.

## Demo

You can view a fully working demo at [demo-nextjs-with-supabase.vercel.app](https://demo-nextjs-with-supabase.vercel.app/).

## Deploy to Vercel

Vercel deployment will guide you through creating a Supabase account and project.

After installation of the Supabase integration, all relevant environment variables will be assigned to the project so the deployment is fully functioning.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fwith-supabase&project-name=nextjs-with-supabase&repository-name=nextjs-with-supabase&demo-title=nextjs-with-supabase&demo-description=This+starter+configures+Supabase+Auth+to+use+cookies%2C+making+the+user%27s+session+available+throughout+the+entire+Next.js+app+-+Client+Components%2C+Server+Components%2C+Route+Handlers%2C+Server+Actions+and+Middleware.&demo-url=https%3A%2F%2Fdemo-nextjs-with-supabase.vercel.app%2F&external-id=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fwith-supabase&demo-image=https%3A%2F%2Fdemo-nextjs-with-supabase.vercel.app%2Fopengraph-image.png)

The above will also clone the Starter kit to your GitHub, you can clone that locally and develop locally.

If you wish to just develop locally and not deploy to Vercel, [follow the steps below](#clone-and-run-locally).

## Clone and run locally

1. You'll first need a Supabase project which can be made [via the Supabase dashboard](https://database.new)

2. Create a Next.js app using the Supabase Starter template npx command

   ```bash
   npx create-next-app --example with-supabase with-supabase-app
   ```

   ```bash
   yarn create next-app --example with-supabase with-supabase-app
   ```

   ```bash
   pnpm create next-app --example with-supabase with-supabase-app
   ```

3. Use `cd` to change into the app's directory

   ```bash
   cd with-supabase-app
   ```

4. Rename `.env.example` to `.env.local` and update the following:

  ```env
  NEXT_PUBLIC_SUPABASE_URL=[INSERT SUPABASE PROJECT URL]
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[INSERT SUPABASE PROJECT API PUBLISHABLE OR ANON KEY]
  ```
  > [!NOTE]
  > This example uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which refers to Supabase's new **publishable** key format.
  > Both legacy **anon** keys and new **publishable** keys can be used with this variable name during the transition period. Supabase's dashboard may show `NEXT_PUBLIC_SUPABASE_ANON_KEY`; its value can be used in this example.
  > See the [full announcement](https://github.com/orgs/supabase/discussions/29260) for more information.

  Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` can be found in [your Supabase project's API settings](https://supabase.com/dashboard/project/_?showConnect=true)

5. You can now run the Next.js local development server:

   ```bash
   npm run dev
   ```

   The starter kit should now be running on [localhost:3000](http://localhost:3000/).

6. This template comes with the default shadcn/ui style initialized. If you instead want other ui.shadcn styles, delete `components.json` and [re-install shadcn/ui](https://ui.shadcn.com/docs/installation/next)

> Check out [the docs for Local Development](https://supabase.com/docs/guides/getting-started/local-development) to also run Supabase locally.

## Feedback and issues

Please file feedback and issues over on the [Supabase GitHub org](https://github.com/supabase/supabase/issues/new/choose).

## More Supabase examples

- [Next.js Subscription Payments Starter](https://github.com/vercel/nextjs-subscription-payments)
- [Cookie-based Auth and the Next.js 13 App Router (free course)](https://youtube.com/playlist?list=PL5S4mPUpp4OtMhpnp93EFSo42iQ40XjbF)
- [Supabase Auth and the Next.js App Router](https://github.com/supabase/supabase/tree/master/examples/auth/nextjs)
