import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runAttendanceReminders } from '@/lib/notifications/worker';
import { runOperationsWorker } from '@/lib/store-ops/worker';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
    const headers = { 'Cache-Control': 'no-store, private' };
    const secret = process.env.ATTENDANCE_REMINDER_WORKER_SECRET;
    if (!secret || secret.length < 32) return NextResponse.json({ error: 'Reminder worker is not configured.' }, { status: 503, headers });
    const supplied = request.headers.get('authorization') || '';
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (!timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    // The existing authenticated schedule can deliver both feeds without a second secret/job.
    // A failed worker must not stop the other queue from draining.
    const [attendance, operations] = await Promise.allSettled([runAttendanceReminders(), runOperationsWorker()]);
    const success = attendance.status === 'fulfilled' && operations.status === 'fulfilled';
    return NextResponse.json({ success,
        data: attendance.status === 'fulfilled' ? attendance.value : null,
        operations: operations.status === 'fulfilled' ? operations.value : null,
        ...(!success ? { error: 'Some notification deliveries could not be confirmed. The next scheduled run can retry.' } : {}),
    }, { status: success ? 200 : 503, headers });
}
