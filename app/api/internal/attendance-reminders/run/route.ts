import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runAttendanceReminders } from '@/lib/notifications/worker';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
    const headers = { 'Cache-Control': 'no-store, private' };
    const secret = process.env.ATTENDANCE_REMINDER_WORKER_SECRET;
    if (!secret || secret.length < 32) return NextResponse.json({ error: 'Reminder worker is not configured.' }, { status: 503, headers });
    const supplied = request.headers.get('authorization') || '';
    const digest = (value: string) => createHash('sha256').update(value).digest();
    if (!timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    try { return NextResponse.json({ success: true, data: await runAttendanceReminders() }, { headers }); }
    catch { return NextResponse.json({ success: false, error: 'Reminder processing could not be confirmed.' }, { status: 503, headers }); }
}
