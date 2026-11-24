import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/push";
import { submitShiftRequest } from '@/lib/shifts/service';

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
        const data = await submitShiftRequest(supabase, userId, shiftId, message, note ?? null);

        // 4. Trigger Push Notification
        const name = profile?.full_name || 'An employee';
        await sendPushNotification(
            'New Shift Exchange/Request',
            `${name} has submitted a shift change request.`,
            '/admin'
        );

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        console.error('Swap request API error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to process request' }, { status: 409 });
    }
}
