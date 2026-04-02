import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/push";

export async function POST(request: Request) {
    try {
        const supabase = await createClient();

        // 1. Verify the requester is an admin
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
        }

        // 2. Trigger a test notification
        await sendPushNotification(
            'Test Notification',
            'This is a test notification from your Admin Dashboard.',
            '/admin'
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Test push error:', error);
        return NextResponse.json({ error: 'Failed to send test notification' }, { status: 500 });
    }
}
