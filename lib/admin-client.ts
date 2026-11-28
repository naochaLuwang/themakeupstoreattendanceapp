import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { cache } from 'react'
import type { Database } from '@/lib/supabase/database.types'

/** Server-only maintenance credential. Call only after a verified role or worker secret. */
export function createServiceClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!key || !url) throw new Error('Server maintenance is not configured.');
    return createSupabaseClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const getStaffAccess = cache(async () => {
    const client = await createServerClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;

    const { data: profile } = await client.from('profiles')
        .select('role, store_id').eq('id', user.id).single();
    return { client, profile, userId: user.id };
});
