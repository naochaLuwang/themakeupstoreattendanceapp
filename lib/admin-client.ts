import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

/** Server-only maintenance credential. Call only after a verified role or worker secret. */
export function createServiceClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!key || !url) throw new Error('Server maintenance is not configured.');
    return createSupabaseClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getAdminClient() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        throw new Error("Forbidden: Admin access only");
    }

    return createServiceClient();
}
