import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
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

        // 3. Insert swap request
        const data = await submitShiftRequest(supabase, userId, shiftId, message, note ?? null);

        return NextResponse.json({ success: true, data });
    } catch (error: unknown) {
        console.error('Swap request API error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to process request' }, { status: 409 });
    }
}
