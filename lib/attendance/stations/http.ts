import { NextResponse, type NextRequest } from 'next/server';
import { attendanceUuid, AttendanceInputError } from '@/lib/attendance/engine';
import { STATION_COOKIE, STATION_COOKIE_PATH, newStationCredential, validStationCredential } from './crypto';
import { stationDeviceCommand } from './server';
import { isAttendanceOrigin } from '../origin';

const headers = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export async function stationDevicePost(request: NextRequest, action: string) {
    const send = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: STATION_COOKIE_PATH };
    try {
        if (!['start', 'status', 'heartbeat', 'issue', 'forget'].includes(action)) return send({ success: false, code: 'INVALID', error: 'Unknown display action.' }, 404);
        if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return send({ success: false, code: 'INVALID', error: 'Send display requests as JSON.' }, 415);
        if (!isAttendanceOrigin(request)) return send({ success: false, code: 'FORBIDDEN', error: 'Use this workspace to manage the display.' }, 403);
        const text = await request.text();
        if (text.length > 1024) return send({ success: false, code: 'INVALID', error: 'Display request is too large.' }, 413);
        const input: unknown = JSON.parse(text);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AttendanceInputError('Invalid display request.');
        const body = input as Record<string, unknown>;
        const stationId = attendanceUuid(body.stationId, 'station ID');
        let credential = request.cookies.get(STATION_COOKIE)?.value;
        if (action === 'start' && !validStationCredential(credential)) credential = newStationCredential();
        if (action === 'forget' && !validStationCredential(credential)) {
            const response = send({ success: true, data: { unpaired: true } });
            response.cookies.set(STATION_COOKIE, '', { ...cookieOptions, maxAge: 0 });
            return response;
        }
        if (!validStationCredential(credential)) return send({ success: false, code: 'UNPAIRED', error: 'Pair this display to continue.' }, 401);
        if (action === 'start') {
            const existing = await stationDeviceCommand('status', credential, stationId);
            if (!existing.success && existing.error.includes('another station')) return send(existing, 409);
            if (!existing.success && existing.code === '42501') credential = newStationCredential();
        }
        const requestId = action === 'issue' ? attendanceUuid(body.requestId, 'QR request ID') : undefined;
        const result = await stationDeviceCommand(action as 'start' | 'status' | 'heartbeat' | 'issue' | 'forget', credential, action === 'forget' ? null : stationId, requestId);
        const response = send(result, result.success ? 200 : result.code === 'RATE_LIMITED' ? 429 : result.code === '42501' ? 401 : result.code === 'NOT_INSTALLED' ? 503 : 400);
        if ((result.success && action === 'start') || (action === 'forget' && (result.success || result.code === '42501'))) response.cookies.set(STATION_COOKIE, action === 'forget' ? '' : credential, {
            ...cookieOptions,
            maxAge: action === 'forget' ? 0 : (result.success && result.data.station ? result.data.station.credential_days : 90) * 86400,
        });
        return response;
    } catch (error: unknown) {
        return send({ success: false, code: 'UNAVAILABLE', error: error instanceof AttendanceInputError ? error.message : 'The display could not reach the station. Retry when connected.' }, error instanceof AttendanceInputError || error instanceof SyntaxError ? 400 : 503);
    }
}
