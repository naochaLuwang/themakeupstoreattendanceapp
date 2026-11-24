import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';
import { queueAttendanceNotification } from '../server';
import type { SmartCommand, SmartFailure, SmartReply } from './types';

export function smartFailure(message: string, code = 'UNAVAILABLE'): SmartFailure {
    if (code === 'PGRST202' || code === '42883') return { success: false, error: 'Smart Scan is not ready for this workspace yet. Use manual attendance and let your manager know.', code: 'NOT_INSTALLED', status: 503 };
    const known = /^(ATTENDANCE|STATION)_/.test(message);
    return { success: false, error: known ? message.replace(/^(?:ATTENDANCE|STATION)_[A-Z_]+:\s*/, '') : 'Attendance could not be confirmed. Refresh its status before retrying.', code,
        status: !known ? 503 : /UNAUTHORIZED/.test(message) ? 401 : code === '42501' ? 403 : code === '23514' ? 409 : 400 };
}
export async function performSmartScan(command: SmartCommand | { action: 'config' }, operationId?: string): Promise<SmartReply> {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return smartFailure('ATTENDANCE_UNAUTHORIZED: sign in to continue', '42501');
    const { data, error } = await client.rpc('attendance_smart_scan', { p_command: command as unknown as Json, ...(operationId ? { p_operation_id: operationId } : {}) });
    if (error) return smartFailure(error.message, error.code);
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.success !== 'boolean') return smartFailure('Invalid response');
    if (!data.success) return smartFailure(typeof data.error === 'string' ? data.error : '', typeof data.code === 'string' ? data.code : undefined);
    if (data.state === 'ready') {
        if (command.action !== 'config' || typeof data.enabled !== 'boolean' || !data.policy || !data.attendance) return smartFailure('Invalid configuration');
    } else {
        if (command.action === 'config' || !['clocked_in', 'completed', 'confirmation_required'].includes(String(data.state)) || !data.data || typeof data.data !== 'object' || Array.isArray(data.data) || typeof data.data.id !== 'string' || typeof data.data.check_in !== 'string') return smartFailure('Invalid attendance response');
        if (!Number.isFinite(Date.parse(data.data.check_in)) || (data.state === 'completed' && (typeof data.data.check_out !== 'string' || !Number.isFinite(Date.parse(data.data.check_out))))) return smartFailure('Invalid attendance time');
        if (data.state === 'confirmation_required' && (typeof data.confirmationId !== 'string' || typeof data.expiresAt !== 'string' || typeof data.serverNow !== 'string' || !Number.isFinite(Date.parse(data.expiresAt)) || !Number.isFinite(Date.parse(data.serverNow)))) return smartFailure('Invalid confirmation');
    }
    const result = data as unknown as SmartReply;
    if (result.success && result.state !== 'ready' && result.state !== 'confirmation_required' && result.changed && !result.replayed) queueAttendanceNotification(user.id, result.state === 'clocked_in' ? 'clock_in' : 'clock_out');
    return result;
}
