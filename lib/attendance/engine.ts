import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';

export type AttendanceRecord = Database['public']['Tables']['attendance']['Row'];
export type AttendanceState = 'not_started' | 'clocked_in' | 'completed' | 'attendance_exception' | 'pending_review';
export type EntryPoint = 'app_dashboard' | 'server_action' | 'admin_console';
export type AttendanceCommand =
    | { action: 'clock_in'; employeeId: string; storeId: string; shiftId?: string | null; lat: number; lng: number; accuracy?: number; capturedAt?: string }
    | { action: 'clock_out'; employeeId: string; attendanceId?: string; expectedVersion?: number }
    | { action: 'admin_create'; employeeId: string; shift_id: string; check_in: string; check_out?: string | null; reason?: string }
    | { action: 'admin_update'; attendanceId: string; updates: { check_in?: string; check_out?: string | null; shift_id?: string }; expectedVersion?: number; reason?: string }
    | { action: 'admin_delete' | 'admin_close'; attendanceId: string; expectedVersion?: number; reason?: string }
    | { action: 'approve_reentry'; requestId: string; reason?: string }
    | { action: 'state' };

export type AttendanceResult = {
    success: true;
    state: AttendanceState;
    data: AttendanceRecord | null;
    changed?: boolean;
    replayed?: boolean;
    count?: number;
    message?: string;
    policy?: { radiusMeters: number; maxAccuracyMeters: number; maxLocationAgeSeconds: number; requireLocationMetadata: boolean; smartQrEnabled?: boolean };
} | { success: false; error: string; code: string; status: number };

export class AttendanceInputError extends Error {}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function attendanceUuid(value: unknown, label: string): string {
    if (typeof value !== 'string' || !uuidPattern.test(value)) throw new AttendanceInputError(`A valid ${label} is required.`);
    return value;
}
function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AttendanceInputError('Invalid attendance request.');
    return value as Record<string, unknown>;
}
function coordinate(value: unknown, maximum: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > maximum) throw new AttendanceInputError('Your location could not be verified. Obtain a fresh location and retry.');
    return value;
}
export function attendanceLocation(input: Record<string, unknown>, requireMetadata = false) {
    const accuracy = input.accuracy;
    const captured = input.capturedAt;
    if ((accuracy === undefined) !== (captured === undefined) || (requireMetadata && accuracy === undefined)) throw new AttendanceInputError('Obtain a fresh location with accuracy and capture time.');
    if (accuracy !== undefined && (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy < 0)) throw new AttendanceInputError('Location accuracy is invalid. Obtain a new reading.');
    if (captured !== undefined && (typeof captured !== 'string' || !Number.isFinite(Date.parse(captured)))) throw new AttendanceInputError('Location capture time is invalid. Obtain a new reading.');
    return { lat: coordinate(input.lat, 90), lng: coordinate(input.lng, 180), ...(accuracy !== undefined ? { accuracy: accuracy as number, capturedAt: captured as string } : {}) };
}
export function parseAttendanceRequest(value: unknown, action: 'clock_in' | 'clock_out') {
    const input = object(value);
    const employeeId = attendanceUuid(input.userId, 'employee ID');
    const operationId = input.operationId === undefined ? crypto.randomUUID() : attendanceUuid(input.operationId, 'operation ID');
    let command: AttendanceCommand;
    if (action === 'clock_in') {
        const location = attendanceLocation(input);
        command = {
            action, employeeId, storeId: attendanceUuid(input.storeId, 'store ID'),
            shiftId: input.shiftId == null ? null : attendanceUuid(input.shiftId, 'shift ID'),
            ...location,
        };
    } else {
        if (input.expectedVersion !== undefined && (typeof input.expectedVersion !== 'number' || !Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1)) throw new AttendanceInputError('Attendance version is invalid. Refresh attendance.');
        command = {
            action, employeeId,
            ...(input.attendanceId !== undefined ? { attendanceId: attendanceUuid(input.attendanceId, 'attendance session') } : {}),
            ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion as number } : {}),
        };
    }
    return { command, operationId };
}

function failure(message: string, code = 'ATTENDANCE_ERROR'): Extract<AttendanceResult, { success: false }> {
    let status = 400;
    if (message.includes('UNAUTHORIZED')) status = 401;
    else if (code === '42501' || message.includes('FORBIDDEN') || message.includes('WRONG_BRANCH')) status = 403;
    else if (['40001', '40P01', '55P03', '57014'].includes(code)) { status = 503; message = 'Attendance is busy. Refresh your attendance before retrying.'; }
    else if (code === '23514' || /CONFLICT|STALE|COMPLETED/.test(message)) status = 409;
    else if (code === 'PGRST202' || code === '42883') { status = 503; message = 'Attendance engine is not installed. Apply migration 006 before deploying these attendance adapters.'; }
    else if (!message.startsWith('ATTENDANCE_') && !message.startsWith('SHIFT_')) { status = 503; message = 'Attendance could not be confirmed. Refresh your attendance before retrying.'; }
    return { success: false, error: message.replace(/^(ATTENDANCE_[A-Z_]+|SHIFT_[A-Z_]+):\s*/, ''), code, status };
}

/** All server entry points share this adapter; PostgreSQL is the authority. */
export async function transitionAttendance(
    client: SupabaseClient<Database>, command: AttendanceCommand,
    operationId = crypto.randomUUID(), entryPoint: EntryPoint = 'app_dashboard',
): Promise<AttendanceResult> {
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return failure('ATTENDANCE_UNAUTHORIZED: sign in to continue');
    if ('employeeId' in command && (command.action === 'clock_in' || command.action === 'clock_out') && command.employeeId !== user.id) return failure('ATTENDANCE_FORBIDDEN: attendance belongs to another employee', '42501');
    const { data, error } = await client.rpc('attendance_transition', {
        p_command: command as Json, p_operation_id: operationId, p_entry_point: entryPoint,
    });
    if (error) return failure(error.message, error.code);
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.success !== 'boolean') return failure('Invalid attendance response');
    if (!data.success) return failure(typeof data.error === 'string' ? data.error : 'Attendance could not be confirmed', typeof data.code === 'string' ? data.code : undefined);
    if (typeof data.state !== 'string' || !['not_started', 'clocked_in', 'completed', 'attendance_exception', 'pending_review'].includes(data.state)) return failure('Invalid attendance state');
    if (command.action !== 'state' && data.data == null) return failure('Invalid attendance record');
    // The typed RPC is generated by migration 006; unknown responses fail closed.
    if (data.data != null && (typeof data.data !== 'object' || Array.isArray(data.data) || typeof data.data.id !== 'string' || typeof data.data.check_in !== 'string')) return failure('Invalid attendance record');
    return data as unknown as Extract<AttendanceResult, { success: true }>;
}
