import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendPushNotification } from '@/lib/push';
import { transitionAttendance, type AttendanceCommand, type EntryPoint } from './engine';

export function queueAttendanceNotification(employeeId: string, action: 'clock_in' | 'clock_out') {
    after(async () => {
        try {
            const client = await createClient();
            const { data: profile } = await client.from('profiles').select('full_name').eq('id', employeeId).single();
            const name = profile?.full_name || 'An employee';
            await sendPushNotification(action === 'clock_in' ? 'Clock-In Alert' : 'Clock-Out Alert', action === 'clock_in' ? `${name} has just clocked in.` : `${name} has completed their shift.`, '/admin');
        } catch { console.warn('Attendance saved; admin notification could not be delivered.'); }
    });
}

/** No service-role key is used: the RPC authorizes the caller's verified identity. */
export async function performAttendance(command: AttendanceCommand, operationId?: string, entryPoint: EntryPoint = 'app_dashboard') {
    const client = await createClient();
    const result = await transitionAttendance(client, command, operationId, entryPoint);
    if (result.success && result.changed && (command.action === 'clock_in' || command.action === 'clock_out')) {
        // Notification delivery must never turn a committed attendance event into a failed operation.
        queueAttendanceNotification(command.employeeId, command.action);
    }
    return result;
}
