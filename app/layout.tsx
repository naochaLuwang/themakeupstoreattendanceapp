import InstallPWA from "@/components/InstallPWA";
import "./globals.css";
import NextTopLoader from 'nextjs-toploader';
import { Metadata } from "next";
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: {
    default: "MUS Attendance App",
    template: "%s | THE MAKEUP STORE WANGKHEI",
  },
  description: "Attendance tracking app for THE MAKEUP STORE WANGKHEI employees.",
  // manifest: "/manifest.webmanifest",
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
    description: "Attendance tracking app for THE MAKEUP STORE WANGKHEI employees.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MUS Attendance App",
    description: "Attendance tracking app for THE MAKEUP STORE WANGKHEI employees.",
  },
  icons: {
    apple: [
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          window.addEventListener('error', (e) => {
            if (e.message && (e.message.includes('Loading chunk') || e.message.includes('Loading CSS chunk') || e.message.includes('reading \\'payload\\''))) {
              console.log('Chunk error detected, self-healing reload...');
              window.location.reload();
            }
          }, true);
          window.addEventListener('unhandledrejection', (e) => {
            if (e.reason && e.reason.message && e.reason.message.includes('reading \\'payload\\'')) {
               console.log('Rejection error detected, self-healing reload...');
               window.location.reload();
            }
          });
        ` }} />
      </head>
      <body className="antialiased">
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
        <Toaster position="top-center" richColors />
        <InstallPWA />
      </body>
    </html>
  );
}