import 'server-only';
import { after } from 'next/server';

/** The database owns event creation/deduplication; this only wakes delivery. */
export function deliverAttendanceAlerts() {
    try {
        after(async () => {
            try {
                const { runOperationsWorker } = await import('@/lib/store-ops/worker');
                await runOperationsWorker({ plan: false });
            } catch {
                // The durable queue remains available to the scheduled worker.
                console.warn('Attendance alert delivery deferred to the notification worker.');
            }
        });
    } catch {
        // A caller outside a request can still rely on scheduled queue delivery.
    }
}
