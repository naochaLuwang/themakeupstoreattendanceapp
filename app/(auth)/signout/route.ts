import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const supabase = await createClient();

    // 1. Check if a user session exists before trying to sign out
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        await supabase.auth.signOut();
    }

    // 2. Redirect back to the login page
    const url = new URL(request.url);
    return NextResponse.redirect(new URL('/login', url.origin), {
        status: 302,
    });
}