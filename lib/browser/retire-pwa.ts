/** Remove only this app's former workers/caches. Never reload or clear login/drafts. */
export async function retirePwa() {
    if (typeof window === 'undefined') return;
    const origin = window.location.origin;
    if ('serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.allSettled(registrations.filter(registration => registration.scope === `${origin}/` &&
                [registration.active, registration.waiting, registration.installing].some(worker => {
                    if (!worker) return false;
                    const url = new URL(worker.scriptURL);
                    return url.origin === origin && ['/MUS-SW.js', '/sw.js'].includes(url.pathname);
                })
            ).map(async registration => {
                try { await (await registration.pushManager?.getSubscription())?.unsubscribe(); }
                finally { await registration.unregister(); }
            }));
        } catch { /* Storage restrictions must not interrupt the workspace. */ }
    }
    if ('caches' in window) {
        try {
            const names = await window.caches.keys();
            await Promise.allSettled(names.filter(name =>
                name === 'navigation-cache' || name === 'start-url' || name === `workbox-precache-v2-${origin}/`
            ).map(name => window.caches.delete(name)));
        } catch { /* Browsers can deny access to Cache Storage. */ }
    }
}
