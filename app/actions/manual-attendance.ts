'use server';
import { revalidatePath } from 'next/cache';
import { performAttendance } from '@/lib/attendance/server';
import { attendanceUuid } from '@/lib/attendance/engine';

interface ManualAttendanceParams {
    employee_id: string; shift_id: string; date: string; check_in_time: string; check_out_time?: string;
}
export async function createManualAttendance(params: ManualAttendanceParams) {
    try {
        attendanceUuid(params.employee_id, 'employee ID');
        attendanceUuid(params.shift_id, 'shift ID');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date) || !/^\d{2}:\d{2}$/.test(params.check_in_time) || (params.check_out_time && !/^\d{2}:\d{2}$/.test(params.check_out_time))) return { error: 'Valid attendance date and times are required.' };
        // Keep the existing action's explicit UTC input contract. The correction
        // UI's timezone presentation is a separate, documented migration concern.
        const result = await performAttendance({ action: 'admin_create', employeeId: params.employee_id, shift_id: params.shift_id,
            check_in: `${params.date}T${params.check_in_time}:00+00`, check_out: params.check_out_time ? `${params.date}T${params.check_out_time}:00+00` : null,
            reason: 'Administrator manual attendance entry' }, undefined, 'admin_console');
        if (result.success) revalidatePath('/admin/logs');
        return result.success ? { ...result, error: undefined } : result;
    } catch (error: unknown) { return { error: error instanceof Error ? error.message : 'Attendance could not be saved.' }; }
}
export async function updateManualAttendance(attendanceId: string, updates: { check_in?: string; check_out?: string | null; shift_id?: string }) {
    try {
        attendanceUuid(attendanceId, 'attendance ID');
        const result = await performAttendance({ action: 'admin_update', attendanceId, updates, reason: 'Administrator attendance edit' }, undefined, 'admin_console');
        if (result.success) revalidatePath('/admin/logs');
        return result.success ? { ...result, error: undefined } : result;
    } catch (error: unknown) { return { error: error instanceof Error ? error.message : 'Attendance could not be saved.' }; }
}
export async function deleteManualAttendance(attendanceId: string) {
    try {
        attendanceUuid(attendanceId, 'attendance ID');
        const result = await performAttendance({ action: 'admin_delete', attendanceId, reason: 'Administrator deleted attendance; original retained in audit' }, undefined, 'admin_console');
        if (result.success) revalidatePath('/admin/logs');
        return result.success ? { ...result, error: undefined } : result;
    } catch (error: unknown) { return { error: error instanceof Error ? error.message : 'Attendance could not be deleted.' }; }
}
export async function forceAttendanceClockOut(attendanceId: string, expectedVersion?: number) {
    const result = await performAttendance({ action: 'admin_close', attendanceId, expectedVersion, reason: 'Administrator force clock-out' }, undefined, 'admin_console');
    if (result.success) revalidatePath('/admin');
    return result;
}
