// app/actions/attendance.ts
'use server'
import { createClient } from '@/lib/supabase/server';
import { sendPushNotification } from '@/lib/push';

// Helper for server-side geofence validation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function clockInAction(userId: string, storeId: string, shiftId: string | null, lat: number, lng: number) {
    const supabase = await createClient();

    // 1. Security Check: Verify User Session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.id !== userId) {
        return { error: "Unauthorized: Access denied." };
    }

    // 2. Security Check: Server-side Geofence Verification
    const { data: store } = await supabase.from('stores').select('*').eq('id', storeId).single();
    if (!store) return { error: "Store not found." };
    if (store.lat && store.lng) {
        const distance = calculateDistance(lat, lng, store.lat, store.lng);
        const radius = store.radius_meters || 100;
        if (distance > radius) {
            return { error: `Geofence Violation: You are ${Math.round(distance)}m away. Required < ${radius}m.` };
        }
    }

    // 3. Check for existing active session (prevent duplicates)
    const { data: existing } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', userId)
        .is('check_out', null)
        .order('check_in', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (existing) {
        return { success: true, data: existing, message: "Already clocked in" };
    }

    // 2. Get user profile for notification
    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

    // 3. Insert attendance record
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

    // 4. Trigger Push Notification to Admins
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

    // 1. Security Check: Verify User Session
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

    // 2. Update attendance record(s)
    // We update ALL unclosed sessions for this user to ensure consistency.
    const { data, error } = await supabase
        .from('attendance')
        .update({ check_out: new Date().toISOString() })
        .eq('employee_id', userId)
        .is('check_out', null)
        .select();

    if (error) return { error: error.message };
    if (!data || data.length === 0) return { error: "No active shift found to clock out." };

    // 3. Trigger Push Notification
    const name = profile?.full_name || 'An employee';
    await sendPushNotification(
        'Clock-Out Alert',
        `${name} has completed their shift.`,
        '/admin'
    );

    // Return the most recent updated session if multiple exist
    return { success: true, data: data[0] };
}
