import type { NextConfig } from "next";


import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: false,
  reloadOnOnline: true,
  sw: "MUS-SW.js", // Force a fresh Service Worker name to bypass broken caches
  disable: process.env.NODE_ENV === 'development',
  customWorkerSrc: "worker",
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
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
  /* config options here */

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Set this to 10mb or higher
    },
  }
};

export default withPWA(nextConfig);
