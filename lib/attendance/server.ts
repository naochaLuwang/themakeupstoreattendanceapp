import { createClient } from '@/lib/supabase/server';
import { transitionAttendance, type AttendanceCommand, type EntryPoint } from './engine';

/** No service-role key is used: the RPC authorizes the caller's verified identity. */
export async function performAttendance(command: AttendanceCommand, operationId?: string, entryPoint: EntryPoint = 'app_dashboard') {
    const client = await createClient();
    const result = await transitionAttendance(client, command, operationId, entryPoint);
    return result;
}
