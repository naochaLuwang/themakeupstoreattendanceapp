import RetirePwa from "@/components/RetirePwa";
import NotificationBridge from '@/components/notifications/NotificationBridge';
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

};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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
          <RetirePwa />
          <NotificationBridge />
        </ThemeProvider>
      </body>
    </html>
  );
}
