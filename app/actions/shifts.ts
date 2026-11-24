'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { reviewShiftRequest } from '@/lib/shifts/service';
import { scheduleError } from '@/lib/shifts/rules';
import type { ScheduleMutation, ShiftChange } from '@/lib/shifts/rules';

async function schedulingClient() {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) throw new Error('Sign in to manage schedules.');
    const { data: profile, error: profileError } = await client.from('profiles').select('role').eq('id', user.id).single();
    if (profileError || !profile || !['admin', 'manager'].includes(profile.role)) throw new Error('Only an administrator or manager can manage schedules.');
    return client;
}

export async function reviewShiftRequestAction(requestId: string, decision: 'approved' | 'declined') {
    try {
        if (typeof requestId !== 'string' || !['approved', 'declined'].includes(decision)) throw new Error('Invalid request decision.');
        const client = await schedulingClient();
        await reviewShiftRequest(client, requestId, decision);
        revalidatePath('/admin/weekoff-request');
        revalidatePath('/employee');
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Could not review the shift request.' };
    }
}

export async function publishShiftScheduleAction(changes: ScheduleMutation[], expected: ShiftChange[]) {
    try {
        const client = await schedulingClient();
        if (!Array.isArray(changes) || !Array.isArray(expected) || changes.length > 62 || expected.length > 62) throw new Error('Invalid schedule changes.');
        const { error } = await client.rpc('commit_shift_changes', { p_changes: changes, p_expected: expected });
        if (error) throw new Error(scheduleError(error));
        revalidatePath('/admin/schedule');
        revalidatePath('/employee');
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Could not publish the schedule.' };
    }
}
