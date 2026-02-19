import InstallPWA from "@/components/InstallPWA";
import "./globals.css";
import NextTopLoader from 'nextjs-toploader';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
        <InstallPWA />
      </body>
    </html>
  );
}