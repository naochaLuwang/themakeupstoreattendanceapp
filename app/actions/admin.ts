'use server'
import { getAdminClient } from '@/lib/admin-client'

export async function createNewUser(formData: FormData) {
    try {
        const adminClient = await getAdminClient();

        const email = formData.get('email') as string
        const password = formData.get('password') as string
        const fullName = formData.get('fullName') as string
        const username = formData.get('username') as string
        const role = formData.get('role')
        if (role !== 'admin' && role !== 'manager' && role !== 'employee') return { error: 'Choose a valid staff role.' }
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
    } catch (err: unknown) {
        return { error: err instanceof Error ? err.message : 'Could not create the staff account.' };
    }
}
