import type { Database } from '@/lib/supabase/database.types';

type Shift = Pick<Database['public']['Tables']['shifts']['Row'], 'id' | 'start_time' | 'end_time' | 'shift_label'> & { attendance_started_at?: string | null };
type Leave = Pick<Database['public']['Tables']['leave_requests']['Row'], 'start_date' | 'end_date'>;
export type SwapRequest = Database['public']['Tables']['swap_requests']['Row'];
export type AttendanceRecord = Database['public']['Tables']['attendance']['Row'];
export type AttendanceStatus = 'checking' | 'idle' | 'active' | 'completed';
export type FormattedTime = { time: string; period: string };
export type CalendarDay = {
    id?: string;
    day: number;
    active: boolean;
    isLeave: boolean;
    start: FormattedTime | null;
    end: FormattedTime | null;
    startRaw: string | null;
    endRaw: string | null;
    label: string | null;
    fullDate: string;
    request: SwapRequest | null;
    locked: boolean;
};

/** Date-only schedule values preserve the project's existing wall-date convention. */
export function addScheduleDays(date: string, count: number): string {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + count);
    return value.toISOString().slice(0, 10);
}

export function weekDates(date: string): string[] {
    const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const monday = addScheduleDays(date, -weekday);
    return Array.from({ length: 7 }, (_, index) => addScheduleDays(monday, index));
}

export function calendarRange(year: number, month: number) {
    const first = new Date(Date.UTC(year, month, 1, 12)).toISOString().slice(0, 10);
    const last = new Date(Date.UTC(year, month + 1, 0, 12)).toISOString().slice(0, 10);
    const start = weekDates(first)[0];
    const end = addScheduleDays(weekDates(last)[6], 1);
    const count = Math.round((Date.parse(`${end}T12:00Z`) - Date.parse(`${start}T12:00Z`)) / 86400000);
    return { start, end, dates: Array.from({ length: count }, (_, index) => addScheduleDays(start, index)) };
}

export function scheduleDateLabel(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }): string {
    return new Intl.DateTimeFormat('en-IN', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}

function scheduleTime(value: string | null): FormattedTime | null {
    if (!value) return null;
    const raw = value.includes('T') ? value.split('T')[1].slice(0, 5) : value.split(' ')[1]?.slice(0, 5);
    if (!raw) return null;
    const [hours, minutes] = raw.split(':').map(Number);
    return { time: `${hours % 12 || 12}:${String(minutes).padStart(2, '0')}`, period: hours >= 12 ? 'PM' : 'AM' };
}

export function calendarDay(date: string, shifts: readonly Shift[], leaves: readonly Leave[], requests: readonly SwapRequest[] = []): CalendarDay {
    const shift = shifts.find(row => row.start_time.slice(0, 10) === date);
    const leave = leaves.some(row => row.start_date <= date && row.end_date >= date);
    return {
        id: shift?.id, day: Number(date.slice(8, 10)), fullDate: date,
        active: Boolean(shift), isLeave: leave, label: leave ? 'Leave' : shift?.shift_label || null,
        start: scheduleTime(shift?.start_time || null), end: scheduleTime(shift?.end_time || null),
        startRaw: shift?.start_time.split('T')[1]?.slice(0, 5) || null,
        endRaw: shift?.end_time?.split('T')[1]?.slice(0, 5) || null,
        request: requests.find(row => row.status === 'pending' && (row.shift_id === shift?.id || row.message?.includes(date))) || null,
        locked: Boolean(shift?.attendance_started_at),
    };
}

export function attendanceTime(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(new Date(value));
}

export function workedDuration(record: Pick<AttendanceRecord, 'check_in' | 'check_out'> | null): string | null {
    if (!record?.check_out) return null;
    const minutes = Math.floor((Date.parse(record.check_out) - Date.parse(record.check_in)) / 60000);
    if (!Number.isFinite(minutes) || minutes < 0) return null;
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** Existing roster UTC components represent IST wall times, not UTC instants. */
export function shiftCoversInstant(shift: Pick<Shift, 'start_time' | 'end_time'>, instant = new Date()): boolean {
    if (!shift.end_time) return false;
    const start = Date.parse(`${new Date(shift.start_time).toISOString().slice(0, 19)}+05:30`);
    let end = Date.parse(`${new Date(shift.end_time).toISOString().slice(0, 19)}+05:30`);
    if (end <= start) end += 86400000;
    return instant.getTime() >= start && instant.getTime() < end;
}
