// app/actions/requests.ts
'use server'
import { createClient } from '@/lib/supabase/server';
import { sendPushNotification } from '@/lib/push';

export async function createLeaveRequestAction(userId: string, startDate: string, endDate: string, reason: string) {
    const supabase = await createClient();

    // 1. Get user profile for notification
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

    // 1. Get user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

    // 2. Insert swap request
    const { data, error } = await supabase.from('swap_requests').insert([{
        requestor_id: userId,
        receiver_id: userId, // Current app handles self-request for admin override
        shift_id: shiftId,
        message,
        note: note?.trim() || null,
        status: 'pending'
    }]).select().single();

    if (error) return { error: error.message };

    // 3. Trigger Push Notification
    const name = profile?.full_name || 'An employee';
    await sendPushNotification(
        'New Shift Exchange/Request',
        `${name} has submitted a shift change request.`,
        '/admin'
    );

    return { success: true, data };
}
