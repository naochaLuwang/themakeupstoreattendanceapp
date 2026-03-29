// app/actions/attendance.ts
'use server'
import { createClient } from '@/lib/supabase/server';
import { sendPushNotification } from '@/lib/push';

export async function clockInAction(userId: string, storeId: string, shiftId: string | null, lat: number, lng: number) {
    const supabase = await createClient();

    // 1. Get user profile for notification
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

    // 2. Insert attendance record
    const { data, error } = await supabase.from('attendance').insert([{
        employee_id: userId,
        check_in: new Date().toISOString(),
        is_within_geofence: true,
        shift_id: shiftId,
        store_id: storeId,
        check_in_lat: lat,
        check_in_lng: lng
    }]).select().single();

    if (error) return { error: error.message };

    // 3. Trigger Push Notification to Admins
    const name = profile?.full_name || 'An employee';
    await sendPushNotification(
        'Clock-In Alert',
        `${name} has just clocked in.`,
        '/admin'
    );

    return { success: true, data };
}

export async function clockOutAction(userId: string) {
    const supabase = await createClient();

    // 1. Get user profile for notification
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

    // 2. Update attendance record
    const { data, error } = await supabase
        .from('attendance')
        .update({ check_out: new Date().toISOString() })
        .eq('employee_id', userId)
        .is('check_out', null)
        .select()
        .single();

    if (error) return { error: error.message };

    // 3. Trigger Push Notification
    const name = profile?.full_name || 'An employee';
    await sendPushNotification(
        'Clock-Out Alert',
        `${name} has completed their shift.`,
        '/admin'
    );

    return { success: true, data };
}
