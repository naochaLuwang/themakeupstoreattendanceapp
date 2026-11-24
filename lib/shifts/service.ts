import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getAttendanceDate } from '@/lib/attendance/date';
import { isShiftLocked, moveShift, parseShiftRequest, scheduleError, SHIFT_LOCK_MESSAGE, shiftDate, shiftSnapshot } from './rules';
import type { ShiftState } from './rules';

type Client = SupabaseClient<Database>;
type RequestRow = Database['public']['Tables']['swap_requests']['Row'];

export async function getRequestShifts(client: Client, request: Pick<RequestRow, 'shift_id' | 'requestor_id' | 'receiver_id' | 'message'>) {
    if (!request.shift_id) throw new Error('No scheduled shift is linked to this request.');
    const { data: source, error } = await client.from('shifts').select('*').eq('id', request.shift_id).single();
    if (error || !source) throw new Error('The requested shift could not be loaded. Refresh and try again.');
    if (source.employee_id !== request.requestor_id) throw new Error('This shift no longer belongs to the employee who requested it.');
    const date = shiftDate(source);
    const change = parseShiftRequest(request.message || '', date, Boolean(request.receiver_id && request.receiver_id !== request.requestor_id));
    const targetDate = change.kind === 'date' ? change.targetDate : date;
    if (date < getAttendanceDate() || targetDate < getAttendanceDate()) throw new Error('Past shifts cannot be changed through an ordinary shift request.');

    let target: ShiftState | null = null;
    if (change.kind !== 'time') {
        const targetEmployee = change.kind === 'peer' ? request.receiver_id : request.requestor_id;
        const nextDate = new Date(Date.parse(`${targetDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
        const result = await client.from('shifts').select('*').eq('employee_id', targetEmployee!)
            .gte('start_time', `${targetDate}T00:00:00Z`).lt('start_time', `${nextDate}T00:00:00Z`).neq('id', source.id);
        if (result.error) throw new Error('Could not verify the other date. Refresh and try again.');
        if (result.data.length > 1) throw new Error('More than one shift exists on the other date. Ask an administrator to review the schedule.');
        target = result.data[0] || null;
    }
    const affected = target ? [source, target] : [source];
    const employeeIds = [...new Set([request.requestor_id, request.receiver_id || request.requestor_id])];
    const firstDate = [date, targetDate].sort()[0];
    const lastDate = [date, targetDate].sort()[1];
    const dayAfter = new Date(Date.parse(`${lastDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
    const [linked, dated] = await Promise.all([
        client.from('attendance').select('shift_id, employee_id, check_in').in('shift_id', affected.map(row => row.id)),
        client.from('attendance').select('shift_id, employee_id, check_in').in('employee_id', employeeIds)
            .gte('check_in', `${firstDate}T00:00:00+05:30`).lt('check_in', `${dayAfter}T00:00:00+05:30`),
    ]);
    if (linked.error || dated.error) throw new Error('Could not verify attendance. No changes were made; please retry.');
    const attendance = [...linked.data, ...dated.data];
    if (affected.some(row => isShiftLocked(row, attendance)) || attendance.some(row =>
        !row.shift_id && getAttendanceDate(new Date(row.check_in)) === targetDate
    )) throw new Error(SHIFT_LOCK_MESSAGE);
    return { source, target, change, affected };
}

export async function submitShiftRequest(client: Client, userId: string, shiftId: string, message: string, note: string | null) {
    if (typeof shiftId !== 'string' || typeof message !== 'string' || message.length > 1000 || (note !== null && (typeof note !== 'string' || note.length > 2000))) {
        throw new Error('Invalid shift request.');
    }
    await getRequestShifts(client, { shift_id: shiftId, requestor_id: userId, receiver_id: userId, message });
    const { data, error } = await client.from('swap_requests').insert({
        requestor_id: userId, receiver_id: userId, shift_id: shiftId,
        message, note: note?.trim() || null, status: 'pending',
    }).select().single();
    if (error) throw new Error(scheduleError(error));
    return data;
}

export async function reviewShiftRequest(client: Client, id: string, decision: 'approved' | 'declined') {
    const { data: request, error } = await client.from('swap_requests').select('*').eq('id', id).single();
    if (error || !request) throw new Error('Request could not be loaded.');
    if (request.status !== 'pending') throw new Error('This request is no longer pending.');
    if (decision === 'declined') {
        const result = await client.rpc('commit_shift_changes', { p_changes: [], p_expected: [], p_request_id: id, p_decision: decision });
        if (result.error) throw new Error(scheduleError(result.error));
        return;
    }
    const { source, target, change, affected } = await getRequestShifts(client, request);
    let changes = affected.map(shiftSnapshot);
    if (change.kind === 'time') {
        const { data: presets, error: presetError } = await client.from('shift_presets').select('*').eq('label', change.label);
        if (presetError || presets.length !== 1) throw new Error('The requested preset is missing or ambiguous. Ask the employee to submit a new request.');
        const preset = presets[0];
        if (!preset.start_time || !preset.end_time) throw new Error('This shift preset has no valid start and end time.');
        const timePart = (value: string) => value.includes('T') ? value.split('T')[1].slice(0, 8) : value.slice(0, 8);
        const start = `${shiftDate(source)}T${timePart(preset.start_time)}Z`;
        let end = `${shiftDate(source)}T${timePart(preset.end_time)}Z`;
        if (!Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) throw new Error('The requested preset must have valid start and end times.');
        if (Date.parse(end) <= Date.parse(start)) end = new Date(Date.parse(end) + 86400000).toISOString();
        changes = [{ ...shiftSnapshot(source), start_time: start, end_time: end, shift_label: preset.label }];
    } else if (change.kind === 'peer') {
        changes = [{ ...shiftSnapshot(source), employee_id: request.receiver_id }];
        if (target) changes.push({ ...shiftSnapshot(target), employee_id: request.requestor_id });
    } else if (target) {
        // Keep IDs on their original dates, matching the existing interchange behavior.
        changes = [
            { ...moveShift(target, shiftDate(source)), id: source.id },
            { ...moveShift(source, shiftDate(target)), id: target.id },
        ];
    } else changes = [moveShift(source, change.targetDate)];
    const result = await client.rpc('commit_shift_changes', {
        p_changes: changes, p_expected: affected.map(shiftSnapshot), p_request_id: id, p_decision: decision,
    });
    if (result.error) throw new Error(scheduleError(result.error));
}
