import { NextResponse } from 'next/server';
import { AttendanceInputError, parseAttendanceRequest } from './engine';
import { performAttendance } from './server';
import { isAttendanceOrigin } from './origin';

export async function attendancePost(request: Request, action: 'clock_in' | 'clock_out') {
    try {
        if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return NextResponse.json({ success: false, error: 'Send attendance as JSON.' }, { status: 415 });
        if (!isAttendanceOrigin(request)) return NextResponse.json({ success: false, error: 'Attendance must be submitted from this workspace.' }, { status: 403 });
        const { command, operationId } = parseAttendanceRequest(await request.json(), action);
        const result = await performAttendance(command, operationId);
        return NextResponse.json(result, { status: result.success ? 200 : result.status, headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        const invalid = error instanceof AttendanceInputError || error instanceof SyntaxError;
        return NextResponse.json({ success: false, error: invalid ? error.message : 'Attendance could not be confirmed. Refresh attendance before retrying.' },
            { status: invalid ? 400 : 503, headers: { 'Cache-Control': 'no-store' } });
    }
}
