'use server'
import { createClient } from '@supabase/supabase-js'

// IMPORTANT: Use your SERVICE_ROLE_KEY in .env.local
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
)

export async function createNewUser(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string
    const username = formData.get('username') as string
    const role = formData.get('role') as string
    const storeId = formData.get('storeId') as string

    // 1. Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    })

    if (authError) return { error: authError.message }

    // 2. Update the public.profiles table
    // We use .update because many Supabase triggers auto-create a profile on auth signup.
    // If your trigger doesn't exist, use .insert()
    const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
            full_name: fullName,
            username: username.toLowerCase(), // Store username in lowercase
            role: role,
            store_id: storeId,
            email: email
        })
        .eq('id', authUser.user.id)

    if (profileError) {
        // Cleanup: If profile update fails, we should technically delete the auth user
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        return { error: profileError.message }
    }

    return { success: true }
}