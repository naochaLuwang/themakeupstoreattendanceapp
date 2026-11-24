/* Retirement only: existing installations update to this worker and remove it.
   No fetch handler, offline fallback, push handler or new registration. */
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
    try {
        const names = await caches.keys();
        await Promise.allSettled(names.filter(name =>
            name === 'navigation-cache' || name === 'start-url' || name === `workbox-precache-v2-${self.location.origin}/`
        ).map(name => caches.delete(name)));
    } catch { /* Cache Storage may be disabled by the browser. */ }
    finally {
        await self.registration.unregister();
    }
})()));
