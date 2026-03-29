// worker/index.ts
const swSelf = (self as unknown as any);

swSelf.addEventListener('push', (event: any) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            vibrate: [100, 50, 100],
            data: {
                url: data.url || '/'
            }
        };

        event.waitUntil(
            swSelf.registration.showNotification(data.title, options)
        );
    } catch (err) {
        console.error('Error handling push event:', err);
    }
});

self.addEventListener('notificationclick', (event: any) => {
    event.notification.close();
    event.waitUntil(
        swSelf.clients.openWindow(event.notification.data.url)
    );
});

export {};
