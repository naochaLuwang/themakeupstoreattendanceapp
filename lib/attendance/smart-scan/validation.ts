import { AttendanceInputError, attendanceLocation, attendanceUuid } from '../engine';
import type { SmartCommand, SmartLocation } from './types';

const tokenPattern = /^hrm\.attendance\.v1\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[A-Za-z0-9_-]{43}$/;
export function isAttendanceQr(value: unknown): value is string { return typeof value === 'string' && tokenPattern.test(value); }
export function parseSmartRequest(value: unknown): { command: SmartCommand; operationId: string } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AttendanceInputError('Invalid scan request.');
    const input = value as Record<string, unknown>;
    const operationId = attendanceUuid(input.operationId, 'operation ID');
    if (!input.location || typeof input.location !== 'object' || Array.isArray(input.location)) throw new AttendanceInputError('Obtain a fresh location to verify attendance.');
    const location = attendanceLocation(input.location as Record<string, unknown>, true) as SmartLocation;
    if (input.action === 'scan') {
        if (!isAttendanceQr(input.token)) throw new AttendanceInputError('Scan the current attendance QR on your branch display.');
        return { command: { action: 'scan', token: input.token, location }, operationId };
    }
    if (input.action === 'confirm') return { command: { action: 'confirm', confirmationId: attendanceUuid(input.confirmationId, 'confirmation'), location }, operationId };
    throw new AttendanceInputError('Choose a valid scan action.');
}
