import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  async headers() {
    const protectedPages = ['/attendance-station', '/employee/smart-scan', '/employee/notifications', '/admin/attendance-notifications'].map(source => ({ source, headers: [
      { key: 'Cache-Control', value: 'no-store, private' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    ] }));
    return [...protectedPages, ...['/MUS-SW.js', '/sw.js'].map(source => ({ source, headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] }))];
  },

  async rewrites() {
    // Compatibility for an older installed worker; the replacement only retires it.
    return [{ source: '/sw.js', destination: '/MUS-SW.js' }];
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb', // Set this to 10mb or higher
    },
  }
};

export default nextConfig;
