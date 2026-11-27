import { createClient } from '@/lib/supabase/server';
import { transitionAttendance, type AttendanceCommand, type EntryPoint } from './engine';
import { deliverAttendanceAlerts } from '@/lib/notifications/attendance-events';

/** No service-role key is used: the RPC authorizes the caller's verified identity. */
export async function performAttendance(command: AttendanceCommand, operationId?: string, entryPoint: EntryPoint = 'app_dashboard') {
    const client = await createClient();
    const result = await transitionAttendance(client, command, operationId, entryPoint);
    if (result.success && result.changed && !result.replayed && (command.action === 'clock_in' || command.action === 'clock_out')) deliverAttendanceAlerts();
    return result;
}
