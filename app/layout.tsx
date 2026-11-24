import InstallPWA from "@/components/InstallPWA";
import "./globals.css";
import NextTopLoader from 'nextjs-toploader';
import { Metadata } from "next";
import ThemeProvider from '@/components/ThemeProvider';
import { WORKSPACE_NAME } from '@/lib/branding';

export const metadata: Metadata = {
  title: {
    default: WORKSPACE_NAME,
    template: `%s | ${WORKSPACE_NAME}`,
  },
  description: "Attendance tracking app for THE MAKEUP STORE employees.",
  manifest: "/manifest.webmanifest",
  other: {
    "mobile-web-app-capable": "yes",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MUS Attendance App",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "MUS Attendance App",
    title: "MUS Attendance App",
    description: "Attendance tracking app for THE MAKEUP STORE employees.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MUS Attendance App",
    description: "Attendance tracking app for THE MAKEUP STORE employees.",
  },
  icons: {
    apple: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          window.selfHeal = async () => {
            // Android owns connection recovery; never discard an in-progress form.
            if (window.Capacitor?.isNativePlatform?.()) return;
            try {
              const last = Number(sessionStorage.getItem('hrm:lastRecovery') || 0);
              if (Date.now() - last < 60000) return;
              sessionStorage.setItem('hrm:lastRecovery', String(Date.now()));
            } catch { return; }
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (let registration of registrations) {
                await registration.unregister();
              }
            }
            window.location.reload();
          };

          window.addEventListener('error', (e) => {
            const msg = e.message || '';
            const isChunkError = msg.includes('Loading chunk') || msg.includes('Loading CSS chunk') || msg.includes('reading \\'payload\\'');
            if (isChunkError) {
              console.log('Critical error detected, triggering self-heal...', msg);
              window.selfHeal();
            }
          }, true);

          window.addEventListener('unhandledrejection', (e) => {
            const reason = (e.reason && e.reason.message) || '';
            if (reason.includes('Loading chunk') || reason.includes('Loading CSS chunk') || reason.includes('reading \\'payload\\'')) {
               console.log('Rejection detected, triggering self-heal...', reason);
               window.selfHeal();
            }
          });
        ` }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <NextTopLoader
            color="#0f172a" // Matches your slate-900 color
            initialPosition={0.08}
            crawlSpeed={200}
            height={3}
            crawl={true}
            showSpinner={false}
            easing="ease"
            speed={200}
            shadow="0 0 10px #0f172a,0 0 5px #0f172a"
          />
          <main>
            {children}
          </main>
          <InstallPWA />
        </ThemeProvider>
      </body>
    </html>
  );
}
