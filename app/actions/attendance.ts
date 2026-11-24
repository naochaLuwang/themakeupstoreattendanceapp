'use server';
import { parseAttendanceRequest, AttendanceInputError } from '@/lib/attendance/engine';
import { performAttendance } from '@/lib/attendance/server';

export async function clockInAction(userId: string, storeId: string, shiftId: string | null, lat: number, lng: number,
    location?: { accuracy: number; capturedAt: string; operationId?: string }) {
    try {
        const { command, operationId } = parseAttendanceRequest({ userId, storeId, shiftId, lat, lng, ...location }, 'clock_in');
        return await performAttendance(command, operationId, 'server_action');
    } catch (error: unknown) { return { success: false, error: error instanceof AttendanceInputError ? error.message : 'Could not confirm attendance. Refresh before retrying.' }; }
}
export async function clockOutAction(userId: string, attendanceId?: string, expectedVersion?: number, operationId?: string) {
    try {
        const parsed = parseAttendanceRequest({ userId, attendanceId, expectedVersion, operationId }, 'clock_out');
        return await performAttendance(parsed.command, parsed.operationId, 'server_action');
    } catch (error: unknown) { return { success: false, error: error instanceof AttendanceInputError ? error.message : 'Could not confirm attendance. Refresh before retrying.' }; }
}
