import { NextResponse, type NextRequest } from 'next/server';
import { AttendanceInputError, attendanceUuid } from '@/lib/attendance/engine';
import { isAttendanceOrigin } from '@/lib/attendance/origin';
import { newDeviceCredential, validDeviceCredential } from '@/lib/security/opaque-credential';
import { notificationProviders } from './config';
import { INSTALLATION_COOKIE, notificationAdmin, notificationUser } from './server';
import { notificationCommand, notificationObject, reminderAdminCommand } from './validation';

const headers = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export async function notificationRequest(request: NextRequest, admin = false) {
    const send = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
    try {
        if (!isAttendanceOrigin(request)) return send({ success: false, error: 'Use this workspace to manage notifications.' }, 403);
        const existing = request.cookies.get(INSTALLATION_COOKIE)?.value;
        let secret = validDeviceCredential(existing) ? existing : undefined;
        if (request.method === 'GET') {
            const result = admin ? await notificationAdmin({ action: 'list' }) : await notificationUser({ action: 'config' }, secret);
            return send({ ...result, providers: notificationProviders() }, result.success ? 200 : result.status);
        }
        if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return send({ success: false, error: 'Send notification settings as JSON.' }, 415);
        const text = await request.text();
        if (text.length > 16384) return send({ success: false, error: 'Notification request is too large.' }, 413);
        const input: unknown = JSON.parse(text);
        if (admin) {
            const result = await notificationAdmin(reminderAdminCommand(input));
            return send(result, result.success ? 200 : result.status);
        }
        const command = notificationCommand(input);
        const expectedUserId = attendanceUuid(notificationObject(input).expectedUserId, 'account');
        if (command.action === 'register' && !secret) secret = newDeviceCredential();
        const result = await notificationUser(!secret && (command.action === 'sync' || command.action === 'detach') ? { action: 'config' } : command, secret, expectedUserId);
        const response = send(result, result.success ? 200 : result.status);
        if (result.success && command.action === 'register' && secret) response.cookies.set(INSTALLATION_COOKIE, secret, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 365 * 86400 });
        return response;
    } catch (error: unknown) {
        const invalid = error instanceof AttendanceInputError || error instanceof SyntaxError;
        return send({ success: false, error: invalid ? error.message : 'Could not confirm notification settings. Refresh before retrying.' }, invalid ? 400 : 503);
    }
}
