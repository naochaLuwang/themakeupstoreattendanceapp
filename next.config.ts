import type { NextConfig } from "next";


import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: false, // DON'T cache pages, this leads to 404 chunk errors on new builds
  reloadOnOnline: true,
  sw: "sw.js",
  disable: process.env.NODE_ENV === 'development',
  customWorkerSrc: "worker", // Explicitly name the output service worker
  workboxOptions: {
    disableDevLogs: true,
    skipWaiting: true,
    clientsClaim: true,
    // Provide a runtime caching rule to always bypass the service worker 
    // for Server Actions (POST requests to the same origin).
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.method === 'POST',
        handler: 'NetworkOnly',
        options: {
          backgroundSync: {
            name: 'post-sync',
            options: {
              maxRetentionTime: 24 * 60 // Retry for max of 24 Hours
            }
          }
        }
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

// export default withPWA(nextConfig);
export default nextConfig;
