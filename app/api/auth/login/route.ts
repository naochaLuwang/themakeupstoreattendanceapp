import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const username = formData.get('username') as string;
        const password = formData.get('password') as string;

        if (!username || !password) {
            return NextResponse.json({ error: 'Please fill in all fields' }, { status: 400 });
        }

        const supabase = await createClient();

        // 1. Resolve Email from Username
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .eq('username', username)
            .single();

        if (profileError || !profile?.email) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 2. Perform Auth
        const { error: authError } = await supabase.auth.signInWithPassword({
            email: profile.email,
            password: password,
        });

        if (authError) {
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }

        // 3. Success
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Login API error:', error);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }
}
