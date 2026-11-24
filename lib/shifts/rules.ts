import { getAttendanceDate } from '@/lib/attendance/date';

export const SHIFT_LOCK_MESSAGE = 'Attendance has already started for this shift. Its date, employee and scheduled hours can no longer be changed.';

export type ShiftState = {
    id: string;
    employee_id: string | null;
    start_time: string;
    end_time: string | null;
    shift_label: string | null;
    status: string | null;
    attendance_started_at?: string | null;
};

export type AttendanceLink = { shift_id: string | null; employee_id: string; check_in: string };
export type ShiftChange = Omit<ShiftState, 'attendance_started_at'>;
export type ScheduleMutation = ShiftChange | { id: string; deleted: true };

export function shiftDate(shift: Pick<ShiftState, 'start_time'>): string {
    // Existing schedules store/display their wall-clock date in the UTC date part.
    // Preserve that convention here; converting the schedule model is a separate migration.
    return shift.start_time.slice(0, 10);
}

export function isShiftLocked(shift: ShiftState, attendance: readonly AttendanceLink[]): boolean {
    return Boolean(shift.attendance_started_at) || attendance.some(record =>
        record.shift_id === shift.id ||
        (record.employee_id === shift.employee_id && !record.shift_id && getAttendanceDate(new Date(record.check_in)) === shiftDate(shift))
    );
}

export function shiftSnapshot(shift: ShiftState): ShiftChange {
    return {
        id: shift.id, employee_id: shift.employee_id, start_time: shift.start_time,
        end_time: shift.end_time, shift_label: shift.shift_label, status: shift.status,
    };
}

export function parseShiftRequest(message: string, sourceDate: string, peer: boolean):
    { kind: 'peer' } | { kind: 'time'; label: string } | { kind: 'date'; targetDate: string } {
    if (message.startsWith('OVERRIDE REQUEST')) throw new Error('Attendance overrides use the re-entry approval workflow.');
    if (peer) return { kind: 'peer' };
    const time = /^Shift Change: Move from .+ to (.+) for (\d{4}-\d{2}-\d{2})$/.exec(message);
    if (time) {
        if (time[2] !== sourceDate) throw new Error('This request no longer matches the scheduled date. Ask the employee to submit it again.');
        return { kind: 'time', label: time[1].trim() };
    }
    const dates = message.match(/\d{4}-\d{2}-\d{2}/g);
    if (!dates || dates.length !== 2 || dates[0] === dates[1] || !dates.includes(sourceDate)) {
        throw new Error('This request does not describe a valid shift exchange. Ask the employee to submit it again.');
    }
    const targetDate = dates.find(date => date !== sourceDate)!;
    if (!Number.isFinite(Date.parse(`${targetDate}T00:00:00Z`)) || new Date(`${targetDate}T00:00:00Z`).toISOString().slice(0, 10) !== targetDate) {
        throw new Error('Invalid target date.');
    }
    return { kind: 'date', targetDate };
}

export function moveShift(shift: ShiftState, date: string): ShiftChange {
    const delta = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${shiftDate(shift)}T00:00:00Z`);
    return {
        ...shiftSnapshot(shift),
        start_time: new Date(Date.parse(shift.start_time) + delta).toISOString(),
        end_time: shift.end_time ? new Date(Date.parse(shift.end_time) + delta).toISOString() : null,
    };
}

export function scheduleError(error: { message: string; code?: string }): string {
    if (error.message.includes('SHIFT_ATTENDANCE_LOCKED')) return SHIFT_LOCK_MESSAGE;
    if (error.message.includes('SHIFT_SCHEDULE_STALE')) return 'The schedule changed while you were working. Refresh it and try again.';
    if (error.message.includes('SHIFT_REQUEST_STALE')) return 'This request has changed or is no longer pending. Refresh the request list.';
    if (error.code === 'PGRST202' || error.code === '42883') return 'Shift protection is not installed yet. Apply database migration 005 before publishing or approving schedules.';
    return error.message;
}
