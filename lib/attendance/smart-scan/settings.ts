import { createClient } from '@/lib/supabase/server';
import { attendanceUuid, AttendanceInputError } from '@/lib/attendance/engine';
import type { StationReply } from '@/lib/attendance/stations/types';

export type SmartScanSettingsCommand = { storeId: string; enabled: boolean; expectedUpdatedAt: string | null };
export type SmartScanBranchSettings = { store_id: string; smart_qr_enabled: boolean; updated_at: string };

export async function saveSmartScanSettings(command: SmartScanSettingsCommand): Promise<StationReply<SmartScanBranchSettings>> {
    const fail = (error: string, code = 'UNAVAILABLE'): StationReply<SmartScanBranchSettings> => ({ success: false, error, code });
    try {
        const storeId = attendanceUuid(command.storeId, 'branch');
        if (typeof command.enabled !== 'boolean') throw new AttendanceInputError('Choose whether Smart Scan is enabled.');
        if (command.expectedUpdatedAt !== null && (typeof command.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(command.expectedUpdatedAt)))) {
            throw new AttendanceInputError('Refresh branch settings before saving.');
        }
        const client = await createClient();
        const { data: { user }, error: authError } = await client.auth.getUser();
        if (authError || !user) return fail('Sign in to manage Smart Scan.', 'UNAUTHORIZED');
        const { data: profile, error: profileError } = await client.from('profiles').select('role').eq('id', user.id).single();
        if (profileError || profile?.role !== 'admin') return fail('Only an administrator can change branch QR settings.', 'FORBIDDEN');
        if (command.enabled) {
            // This read proves the redemption RPC is installed; an admin has no employee scan access.
            const { data: config, error: configError } = await client.rpc('attendance_smart_scan', { p_command: { action: 'config' } });
            if (configError || !config || typeof config !== 'object' || Array.isArray(config) ||
                !(config.success === true || (config.success === false && typeof config.error === 'string' && config.error.startsWith('ATTENDANCE_FORBIDDEN:')))) {
                return fail('Smart Scan is not ready. Install the Smart Scan database migration and deploy matching web code first.', 'NOT_INSTALLED');
            }
            const { data: store, error: storeError } = await client.from('stores').select('lat,lng').eq('id', storeId).single();
            if (storeError || !store || typeof store.lat !== 'number' || typeof store.lng !== 'number' || !Number.isFinite(store.lat) || !Number.isFinite(store.lng) || Math.abs(store.lat) > 90 || Math.abs(store.lng) > 180) {
                return fail('Set a valid branch location before enabling Smart Scan.', 'INVALID');
            }
        }
        // Touch only QR flags. Keep radius, strictness and existing creator metadata intact.
        const values = { smart_qr_enabled: command.enabled, ...(command.enabled ? { enforce_engine: true } : {}) };
        const columns = 'store_id,smart_qr_enabled,updated_at';
        const { data, error } = command.expectedUpdatedAt === null
            ? await client.from('attendance_policies').insert({ store_id: storeId, created_by: user.id, ...values }).select(columns).single()
            : await client.from('attendance_policies').update(values).eq('store_id', storeId).eq('updated_at', command.expectedUpdatedAt).select(columns).maybeSingle();
        if (error?.code === '23505' || (!error && !data)) return fail('Branch settings changed. Refresh and try again.', 'CONFLICT');
        if (error || !data) return fail(error?.code === '23514' ? 'Install the Smart Scan database migration before enabling QR attendance.' : 'Branch QR settings could not be saved. Refresh and try again.');
        return { success: true, data };
    } catch (error: unknown) {
        return fail(error instanceof AttendanceInputError ? error.message : 'Branch QR settings could not be saved. Refresh and try again.', 'INVALID');
    }
}
