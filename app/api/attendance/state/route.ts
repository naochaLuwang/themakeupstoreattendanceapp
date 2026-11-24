import { NextResponse } from 'next/server';
import { performAttendance } from '@/lib/attendance/server';
export async function GET() {
    try {
        const result = await performAttendance({ action: 'state' });
        return NextResponse.json(result, { status: result.success ? 200 : result.status, headers: { 'Cache-Control': 'no-store' } });
    } catch {
        return NextResponse.json({ success: false, error: 'Attendance could not be loaded. Check your connection and retry.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
}
