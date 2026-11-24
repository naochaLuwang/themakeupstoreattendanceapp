import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';
import { attendanceUuid, AttendanceInputError } from '@/lib/attendance/engine';
import { devicePairingCode, stationDigest, stationTokenMac, stationQrValue } from './crypto';
import { pairingCode, stationSettings } from './validation';
import type { AttendanceStation, StationAdminCommand, StationError, StationManagementData, StationReply, StationSnapshot } from './types';

export function stationError(error: { message: string; code?: string }): StationError {
    const missing = error.code === 'PGRST202' || error.code === '42883';
    return { success: false, code: missing ? 'NOT_INSTALLED' : error.code || 'UNAVAILABLE', error: missing ? 'Attendance stations are not installed. Apply migration 007 before deploying this module.' : error.message.replace(/^STATION_[A-Z_]+:\s*/, '') };
}
function reply<T>(data: Json, error: { message: string; code?: string } | null): StationReply<T> {
    if (error) return stationError(error);
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.success !== 'boolean') return stationError({ message: 'The station response could not be verified.' });
    if (!data.success) return { success: false, code: typeof data.code === 'string' ? data.code : 'UNAVAILABLE', error: typeof data.error === 'string' ? data.error.replace(/^STATION_[A-Z_]+:\s*/, '') : 'Station request failed.', ...(typeof data.retryAfter === 'number' ? { retryAfter: data.retryAfter } : {}) };
    if (!data.data || typeof data.data !== 'object' || Array.isArray(data.data)) return stationError({ message: 'The station response could not be verified.' });
    return { success: true, data: data.data as unknown as T };
}
export async function stationAdminList(): Promise<StationReply<StationManagementData>> {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return stationError({ message: 'Sign in to manage attendance stations.', code: '42501' });
    const { data, error } = await client.rpc('attendance_station_admin', { p_command: { action: 'list' } });
    return reply<StationManagementData>(data, error);
}
export async function stationAdminCommand(command: StationAdminCommand): Promise<StationReply<AttendanceStation>> {
    try {
        if (command.action !== 'create') attendanceUuid(command.stationId, 'station ID');
        if (command.action === 'create' || command.action === 'update') command = { ...command, settings: stationSettings(command.settings) };
        if (command.action === 'update' && (!command.expectedUpdatedAt || !Number.isFinite(Date.parse(command.expectedUpdatedAt)))) throw new AttendanceInputError('Refresh the station before saving changes.');
        if (command.action === 'update' && typeof command.active !== 'boolean') throw new AttendanceInputError('Station active state is required.');
        if (command.action === 'pair') {
            const name = command.deviceName?.trim();
            if (!name || name.length < 2 || name.length > 80) throw new AttendanceInputError('Name the display using 2 to 80 characters.');
            command = { ...command, code: pairingCode(command.code), deviceName: name };
        }
        if (command.action === 'revoke') attendanceUuid(command.deviceId, 'display ID');
        const client = await createClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) return stationError({ message: 'Sign in to manage attendance stations.', code: '42501' });
        const { data, error } = await client.rpc('attendance_station_admin', { p_command: command as unknown as Json });
        return reply<AttendanceStation>(data, error);
    } catch (error: unknown) {
        return stationError({ message: error instanceof AttendanceInputError ? error.message : 'Station settings could not be saved.', code: 'INVALID' });
    }
}
export async function stationDeviceCommand(action: 'start' | 'status' | 'heartbeat' | 'issue' | 'forget', credential: string, stationId: string | null, requestId?: string): Promise<StationReply<StationSnapshot>> {
    const client = await createClient();
    const mac = requestId ? stationTokenMac(credential, requestId) : undefined;
    const { data, error } = await client.rpc('attendance_station_device', {
        p_action: action, p_credential: credential, p_station_id: stationId,
        ...(requestId ? { p_request_id: requestId, p_token_hash: stationDigest(mac!) } : {}),
        ...(action === 'start' ? { p_pairing_hash: stationDigest(devicePairingCode(credential)) } : {}),
    });
    const result = reply<StationSnapshot>(data, error);
    if (result.success && result.data.state === 'pending') result.data.pairingCode = devicePairingCode(credential);
    if (result.success && result.data.tokenId && result.data.requestId && result.data.expiresAt) {
        result.data.qrValue = stationQrValue(result.data.tokenId, stationTokenMac(credential, result.data.requestId));
    } else if (result.success && action === 'issue') return stationError({ message: 'QR issuance could not be verified.' });
    return result;
}
