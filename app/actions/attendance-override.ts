'use server';
import { revalidatePath } from 'next/cache';
import { attendanceUuid } from '@/lib/attendance/engine';
import { performAttendance } from '@/lib/attendance/server';

export async function approveOverrideRequest(requestId: string) {
    try {
        attendanceUuid(requestId, 're-entry request ID');
        const result = await performAttendance({ action: 'approve_reentry', requestId, reason: 'Administrator approved accidental clock-out re-entry' }, undefined, 'admin_console');
        if (result.success) revalidatePath('/admin');
        return result;
    } catch (error: unknown) { return { success: false, error: error instanceof Error ? error.message : 'Re-entry could not be approved.' }; }
}
