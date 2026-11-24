// app/actions/requests.ts
'use server'
import { createClient } from '@/lib/supabase/server';
import { sendPushNotification } from '@/lib/push';
import { submitShiftRequest } from '@/lib/shifts/service';

export async function createLeaveRequestAction(userId: string, startDate: string, endDate: string, reason: string) {
    const supabase = await createClient();

    // 1. Security Check: Verify Session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
        return { error: "Unauthorized: Access denied." };
    }

    // 2. Get user profile for notification
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

    // 2. Insert leave request
    const { data, error } = await supabase.from('leave_requests').insert([{
        employee_id: userId,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        status: 'pending'
    }]).select().single();

    if (error) return { error: error.message };

    // 3. Trigger Push Notification
    const name = profile?.full_name || 'An employee';
    await sendPushNotification(
        'New Leave Request',
        `${name} has requested leave for ${startDate} to ${endDate}.`,
        '/admin/roaster'
    );

    return { success: true, data };
}

export async function createSwapRequestAction(userId: string, shiftId: string, message: string, note: string | null) {
    const supabase = await createClient();

    // 1. Security Check: Verify Session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
        return { error: "Unauthorized: Access denied." };
    }

    // 2. Get user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

    // 2. Insert swap request
    let data;
    try {
        data = await submitShiftRequest(supabase, userId, shiftId, message, note);
    } catch (error: unknown) {
        return { error: error instanceof Error ? error.message : 'Could not submit the shift request.' };
    }

    // 3. Trigger Push Notification
    const name = profile?.full_name || 'An employee';
    await sendPushNotification(
        'New Shift Exchange/Request',
        `${name} has submitted a shift change request.`,
        '/admin'
    );

    return { success: true, data };
}
