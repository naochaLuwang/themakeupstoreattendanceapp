/** Account for Next's internal URL hostname behind an HTTPS reverse proxy. */
export function isAttendanceOrigin(request: Request): boolean {
    const origin = request.headers.get('origin');
    if (!origin) return true;
    try {
        const target = new URL(request.url);
        const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
        const protocol = forwarded === 'https' || forwarded === 'http' ? `${forwarded}:` : target.protocol;
        return new URL(origin).origin === new URL(`${protocol}//${request.headers.get('host') || target.host}`).origin;
    } catch { return false; }
}
