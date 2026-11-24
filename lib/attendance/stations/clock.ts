/** Conservative monotonic deadline: a slow response cannot extend server expiry. */
export function stationDeadline(serverNow: string, expiresAt: string, requestStarted: number, received: number): number {
    const remaining = Date.parse(expiresAt) - Date.parse(serverNow) - Math.max(0, received - requestStarted);
    return Number.isFinite(remaining) ? received + Math.max(0, remaining) : received;
}
export function stationSeconds(deadline: number, now: number) { return Math.max(0, Math.ceil((deadline - now) / 1000)); }
