import { NextResponse } from 'next/server';
import { AttendanceInputError } from '../engine';
import { isAttendanceOrigin } from '../origin';
import { performSmartScan } from './server';
import { parseSmartRequest } from './validation';

const headers = { 'Cache-Control': 'no-store, private', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export async function smartScanRequest(request: Request) {
    const send = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
    try {
        if (!isAttendanceOrigin(request)) return send({ success: false, error: 'Open Smart Scan in this workspace.', code: 'FORBIDDEN' }, 403);
        if (request.method === 'GET') {
            const result = await performSmartScan({ action: 'config' });
            return send(result, result.success ? 200 : result.status);
        }
        if (request.method !== 'POST') return send({ success: false, error: 'Use POST to scan.', code: 'INVALID' }, 405);
        if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return send({ success: false, error: 'Send scan requests as JSON.', code: 'INVALID' }, 415);
        const text = await request.text();
        if (text.length > 4096) return send({ success: false, error: 'Scan request is too large.', code: 'INVALID' }, 413);
        const { command, operationId } = parseSmartRequest(JSON.parse(text));
        const result = await performSmartScan(command, operationId);
        return send(result, result.success ? 200 : result.status);
    } catch (error: unknown) {
        const invalid = error instanceof AttendanceInputError || error instanceof SyntaxError;
        return send({ success: false, error: invalid ? error.message : 'Attendance could not be confirmed. Check its status before retrying.', code: invalid ? 'INVALID' : 'UNAVAILABLE' }, invalid ? 400 : 503);
    }
}
