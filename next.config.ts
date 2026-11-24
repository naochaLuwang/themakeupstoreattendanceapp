import type { NextConfig } from "next";


import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: false,
  reloadOnOnline: true,
  sw: "MUS-SW.js", // Force a fresh Service Worker name to bypass broken caches
  disable: process.env.NODE_ENV === 'development',
  // customWorkerSrc removed to avoid hashed filenames causing 404s
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    importScripts: ['/push-worker.js'], // Load stable, non-hashed push logic
    runtimeCaching: [
      { urlPattern: ({ url }) => url.pathname === '/attendance-station' || url.pathname === '/employee/smart-scan' || url.pathname === '/api/attendance/smart-scan' || url.pathname.startsWith('/api/attendance/station/'), handler: 'NetworkOnly' },
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'navigation-cache',
          networkTimeoutSeconds: 5
        }
      },
      {
        urlPattern: ({ request }) => request.method === 'POST',
        handler: 'NetworkOnly'
      }
    ]
  },
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig: NextConfig = {
  async headers() {
    return ['/attendance-station', '/employee/smart-scan'].map(source => ({ source, headers: [
      { key: 'Cache-Control', value: 'no-store, private' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ] }));
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Set this to 10mb or higher
    },
  }
};

export default withPWA(nextConfig);
