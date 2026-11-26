export interface AttendanceStation {
    id: string; store_id: string; name: string; active: boolean;
    refresh_seconds: number; validity_seconds: number; heartbeat_seconds: number; offline_seconds: number; credential_days: number;
    issued_count: number; last_issued_at: string | null; created_at: string; updated_at: string; created_by: string | null;
}
export interface StationDevice {
    id: string; station_id: string; name: string; approved_at: string | null; approved_by: string | null;
    pairing_expires_at: string; credential_expires_at: string; revoked_at: string | null; revoked_by: string | null;
    last_seen_at: string | null; created_at: string; updated_at: string; created_by: string | null;
}
export interface StationSettings {
    store_id: string; name: string; refresh_seconds: number; validity_seconds: number;
    heartbeat_seconds: number; offline_seconds: number; credential_days: number;
}
export const stationDefaults = { refresh_seconds: 30, validity_seconds: 45, heartbeat_seconds: 15, offline_seconds: 60, credential_days: 90 };
export type StationAdminCommand =
    | { action: 'create'; settings: StationSettings }
    | { action: 'update'; stationId: string; settings: StationSettings; active: boolean; expectedUpdatedAt: string }
    | { action: 'pair'; stationId: string; code: string; deviceName: string }
    | { action: 'revoke'; stationId: string; deviceId: string };
export type StationError = { success: false; error: string; code: string; retryAfter?: number };
export type StationReply<T> = { success: true; data: T } | StationError;
export interface StationSnapshot {
    state: 'pending' | 'authorized'; device: Omit<StationDevice, 'created_by' | 'approved_by' | 'revoked_by'>; station: Omit<AttendanceStation, 'created_by'>;
    branchName: string; serverNow: string; scanEnabled: boolean;
    tokenId?: string; expiresAt?: string; requestId?: string; pairingCode?: string; qrValue?: string;
}
export interface StationManagementData {
    stations: AttendanceStation[]; devices: StationDevice[]; stores: { id: string; name: string | null; smartQrEnabled?: boolean; policyUpdatedAt?: string | null }[]; serverNow: string;
}
type Table<Row, Required extends keyof Row> = { Row: { [Key in keyof Row]: Row[Key] }; Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>; Update: Partial<Row>; Relationships: [] };
export type StationTables = {
    attendance_stations: Table<AttendanceStation, 'store_id' | 'name'>;
    attendance_station_devices: Table<StationDevice, 'station_id' | 'name' | 'pairing_expires_at' | 'credential_expires_at'>;
};
