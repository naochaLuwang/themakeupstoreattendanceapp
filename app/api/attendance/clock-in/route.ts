import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/push";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function POST(request: Request) {
    try {
        const { userId, storeId, shiftId, lat, lng } = await request.json();

        if (!userId || !storeId || lat === undefined || lng === undefined) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Security Check: Verify User Session
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user || user.id !== userId) {
            return NextResponse.json({ error: "Unauthorized: Access denied." }, { status: 401 });
        }

        // 2. Security Check: Server-side Geofence Verification
        const { data: store } = await supabase.from('stores').select('*').eq('id', storeId).single();
        if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
        
        if (store.lat && store.lng) {
            const distance = calculateDistance(lat, lng, store.lat, store.lng);
            const radius = store.radius_meters || 100;
            if (distance > radius) {
                return NextResponse.json({ 
                    error: `Geofence Violation: You are ${Math.round(distance)}m away. Required < ${radius}m.` 
                }, { status: 403 });
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
            return NextResponse.json({ success: true, data: existing, message: "Already clocked in" });
        }

        // 4. Get user profile for notification
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();

        // 5. Insert attendance record
        const { data, error } = await supabase.from('attendance').insert([{
            employee_id: userId,
            check_in: new Date().toISOString(),
            is_within_geofence: true,
            shift_id: shiftId,
            store_id: storeId,
            check_in_lat: lat,
            check_in_lng: lng
        }]).select().single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // 6. Trigger Push Notification to Admins
        const name = profile?.full_name || 'An employee';
        await sendPushNotification(
            'Clock-In Alert',
            `${name} has just clocked in.`,
            '/admin'
        );

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Clock-in API error:', error);
        return NextResponse.json({ error: 'Failed to process clock-in' }, { status: 500 });
    }
}
