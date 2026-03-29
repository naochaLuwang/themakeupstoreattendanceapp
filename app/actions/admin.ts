'use server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Helper to create an admin client only when needed and only after verified auth
async function getAdminClient() {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error("Unauthorized");

    // Verify admin role first via the standard client (which should have RLS)
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'admin') {
        throw new Error("Forbidden: Admin access only");
    }

    // Now it is safe to return a service_role client for administrative bypass
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        throw new Error("Server Error: Missing Service Role Configuration");
    }

    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
    );
}

export async function createNewUser(formData: FormData) {
    try {
        const adminClient = await getAdminClient();

        const email = formData.get('email') as string
        const password = formData.get('password') as string
        const fullName = formData.get('fullName') as string
        const username = formData.get('username') as string
        const role = formData.get('role') as string
        const storeId = formData.get('storeId') as string

        // 1. Create user in Supabase Auth
        const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        })

        if (authError) return { error: authError.message }

        // 2. Update the public.profiles table
        const { error: profileError } = await adminClient
            .from('profiles')
            .update({
                full_name: fullName,
                username: username.toLowerCase(),
                role: role,
                store_id: storeId,
                email: email
            })
            .eq('id', authUser.user.id)

        if (profileError) {
            await adminClient.auth.admin.deleteUser(authUser.user.id);
            return { error: profileError.message }
        }

        return { success: true }
    } catch (err: any) {
        return { error: err.message };
    }
}