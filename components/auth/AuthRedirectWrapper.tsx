import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AuthRedirectWrapper() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    // Route logic
    if (profile?.role === 'admin') {
        redirect('/admin');
    } else {
        redirect('/employee');
    }

    return null; // This component never actually renders anything
}