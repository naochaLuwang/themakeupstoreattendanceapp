/** Notification taps navigate to a known screen; they never mutate attendance. */
export function notificationPath(value: unknown, fallback = '/employee/notifications'): string {
    if (typeof value !== 'string' || /[\\\s]/.test(value) || value.startsWith('//')) return fallback;
    const pathname = value.split(/[?#]/)[0];
    if (pathname !== '/' && !/^\/(employee|admin)(\/[A-Za-z0-9_-]+)*\/?$/.test(pathname)) return fallback;
    return value;
}
