import type { CapacitorConfig } from '@capacitor/cli';
import app from './mobile/app.json';

const endpoint = new URL(process.env.CAPACITOR_SERVER_URL || app.serverUrl);
if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
    throw new Error('The Android workspace must use an HTTPS URL without embedded credentials.');
}
if (endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
    throw new Error('Set CAPACITOR_SERVER_URL to the workspace origin, without a path, query, or fragment.');
}

// This is an online wrapper: Next.js API routes and Server Actions remain on the hosted server.
const config: CapacitorConfig = {
    appId: app.appId,
    appName: app.appName,
    webDir: 'mobile/www',
    backgroundColor: '#ffffff',
    loggingBehavior: 'debug',
    server: {
        url: endpoint.origin,
        cleartext: false,
        errorPath: 'offline.html',
    },
    android: {
        allowMixedContent: false,
        appendUserAgent: ' MakeupStoreHRM/Android',
        backgroundColor: '#ffffff',
    },
    plugins: {
        SystemBars: {
            insetsHandling: 'native',
        },
    },
};

export default config;
