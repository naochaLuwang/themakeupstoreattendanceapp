import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/push";

export async function POST(request: Request) {
    try {
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Security Check: Verify User Session
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user || user.id !== userId) {
            return NextResponse.json({ error: "Unauthorized: Access denied." }, { status: 401 });
        }

        // 2. Get user profile for notification
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single();

        // 3. Update attendance record(s)
        // We update ALL unclosed sessions for this user to ensure consistency.
        const { data, error } = await supabase
            .from('attendance')
            .update({ check_out: new Date().toISOString() })
            .eq('employee_id', userId)
            .is('check_out', null)
            .select();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!data || data.length === 0) return NextResponse.json({ error: "No active shift found to clock out." }, { status: 404 });

        // 4. Trigger Push Notification
        const name = profile?.full_name || 'An employee';
        await sendPushNotification(
            'Clock-Out Alert',
            `${name} has completed their shift.`,
            '/admin'
        );

        return NextResponse.json({ success: true, count: data.length });
    } catch (error: any) {
        console.error('Clock-out API error:', error);
        return NextResponse.json({ error: 'Failed to process clock-out' }, { status: 500 });
    }
}
