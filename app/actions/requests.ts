// app/actions/requests.ts
'use server'
import { createClient } from '@/lib/supabase/server';
import { submitShiftRequest } from '@/lib/shifts/service';

export async function createLeaveRequestAction(userId: string, startDate: string, endDate: string, reason: string) {
    const supabase = await createClient();

    // 1. Security Check: Verify Session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
        return { error: "Unauthorized: Access denied." };
    }

    // 2. Insert leave request
    const { data, error } = await supabase.from('leave_requests').insert([{
        employee_id: userId,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        status: 'pending'
    }]).select().single();

    if (error) return { error: error.message };

    return { success: true, data };
}

export async function createSwapRequestAction(userId: string, shiftId: string, message: string, note: string | null) {
    const supabase = await createClient();

    // 1. Security Check: Verify Session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
        return { error: "Unauthorized: Access denied." };
    }

    // 2. Insert swap request
    let data;
    try {
        data = await submitShiftRequest(supabase, userId, shiftId, message, note);
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Could not submit the shift request.' };
    }

    return { success: true, data };
}
