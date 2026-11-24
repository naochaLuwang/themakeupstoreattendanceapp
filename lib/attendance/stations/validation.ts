import { attendanceUuid, AttendanceInputError } from '@/lib/attendance/engine';
import type { StationSettings } from './types';
export function stationSettings(value: unknown): StationSettings {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AttendanceInputError('Station settings are required.');
    const input = value as Record<string, unknown>;
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (name.length < 2 || name.length > 80) throw new AttendanceInputError('Use a station name between 2 and 80 characters.');
    const number = (key: string, min: number, max: number) => {
        const v = input[key]; if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new AttendanceInputError(`${key.replaceAll('_', ' ')} must be between ${min} and ${max}.`); return v;
    };
    const settings = { store_id: attendanceUuid(input.store_id, 'branch'), name,
        refresh_seconds: number('refresh_seconds', 15, 120), validity_seconds: number('validity_seconds', 20, 180),
        heartbeat_seconds: number('heartbeat_seconds', 5, 60), offline_seconds: number('offline_seconds', 30, 600), credential_days: number('credential_days', 1, 365) };
    if (settings.validity_seconds < settings.refresh_seconds + 5) throw new AttendanceInputError('QR validity must exceed the refresh interval by at least 5 seconds.');
    if (settings.offline_seconds < settings.heartbeat_seconds * 2) throw new AttendanceInputError('Offline threshold must allow at least two heartbeat intervals.');
    return settings;
}
export function pairingCode(value: unknown) {
    const code = typeof value === 'string' ? value.replace(/[ -]/g, '').toUpperCase() : '';
    if (!/^[0-9A-HJKMNP-TV-Z]{8}$/.test(code)) throw new AttendanceInputError('Enter the 8-character code shown on the display.');
    return code;
}
