import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/push";

export async function POST(request: Request) {
    try {
        const { userId, shiftId, message, note } = await request.json();

        if (!userId || !shiftId || !message) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Security Check: Verify Session
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

        // 3. Insert swap request
        const { data, error } = await supabase.from('swap_requests').insert([{
            requestor_id: userId,
            receiver_id: userId, // Current app handles self-request for admin override
            shift_id: shiftId,
            message,
            note: note?.trim() || null,
            status: 'pending'
        }]).select().single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        // 4. Trigger Push Notification
        const name = profile?.full_name || 'An employee';
        await sendPushNotification(
            'New Shift Exchange/Request',
            `${name} has submitted a shift change request.`,
            '/admin'
        );

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Swap request API error:', error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}
