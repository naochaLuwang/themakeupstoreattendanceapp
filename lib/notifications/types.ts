export type ReminderKind = 'upcoming_shift' | 'missed_clock_in' | 'late_arrival' | 'shift_ending' | 'missed_clock_out' | 'unresolved_attendance' | 'reentry_approved';
export interface ReminderPreferences {
    enabled: boolean; upcoming_shift: boolean; missed_clock_in: boolean; shift_ending: boolean; missed_clock_out: boolean; manager_alerts: boolean;
    quiet_start: number | null; quiet_end: number | null;
}
export interface ReminderTiming {
    enabled: boolean; upcoming_minutes: number; missed_in_minutes: number; late_minutes: number; ending_minutes: number;
    missed_out_minutes: number; unresolved_minutes: number; cooldown_minutes: number; delivery_window_minutes: number;
}
type Metadata = { id: string; created_at: string; updated_at: string; created_by: string | null };
export type ReminderSettings = ReminderTiming & Metadata & { store_id: string; last_planned_at: string | null };
export type NotificationDevice = Metadata & { user_id: string; provider: 'fcm' | 'webpush'; name: string; enabled: boolean; last_seen_at: string; revoked_at: string | null };
export type NotificationError = { success: false; error: string; code: string; status: number };
export type NotificationReply<T> = { success: true; data: T } | NotificationError;
export interface NotificationUserData {
    userId: string;
    preferences: ReminderPreferences; devices: Omit<NotificationDevice, 'created_by'>[]; currentDeviceId: string | null;
    branchEnabled: boolean; role: 'admin' | 'manager' | 'employee';
}
export interface NotificationAdminData { stores: { id: string; name: string | null; settings: ReminderSettings | null; pending: number; sent: number; blocked: number }[] }
export type DeviceRegistration = { action: 'register'; name: string; provider: 'fcm'; credential: { token: string } };
export type NotificationCommand = DeviceRegistration | ({ action: 'preferences' } & ReminderPreferences) | { action: 'sync' | 'detach' } | { action: 'revoke'; deviceId: string };
export type ReminderAdminCommand = { action: 'list' } | { action: 'save'; storeId: string; expectedUpdatedAt: string | null; settings: ReminderTiming };
export type ProviderState = { fcm: boolean; worker: boolean };
export type DeliveryLease = { id: string; leaseToken: string };
export type AuthorizedDelivery = { allowed: false } | { allowed: true; provider: 'fcm' | 'webpush'; credential: unknown; expiresAt: string; notificationId: string; url: string; category?: 'operations' | 'attendance_event' };
export type DeliveryResult = { outcome: 'sent' | 'retry' | 'invalid_device' | 'permanent' | 'blocked_configuration'; errorCode?: string; retryAfter?: number };
type Table<Row, Required extends keyof Row> = { Row: { [K in keyof Row]: Row[K] }; Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>; Update: Partial<Row>; Relationships: [] };
export type NotificationTables = {
    attendance_reminder_settings: Table<ReminderSettings, 'store_id'>;
    attendance_notification_preferences: Table<ReminderPreferences & Metadata & { user_id: string }, 'user_id'>;
    attendance_notification_devices: Table<NotificationDevice, 'user_id' | 'provider' | 'name'>;
};
export const defaultPreferences: ReminderPreferences = { enabled: true, upcoming_shift: true, missed_clock_in: true, shift_ending: true, missed_clock_out: true, manager_alerts: true, quiet_start: null, quiet_end: null };
export const defaultReminderTiming: ReminderTiming = { enabled: false, upcoming_minutes: 15, missed_in_minutes: 5, late_minutes: 30, ending_minutes: 5, missed_out_minutes: 15, unresolved_minutes: 60, cooldown_minutes: 15, delivery_window_minutes: 30 };
