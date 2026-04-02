'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(_prevState: any, formData: FormData) {
    console.log('Login action hit!');
    const supabase = await createClient()

    // 1. Get username and password from the form
    const username = formData.get('username') as string
    const password = formData.get('password') as string

    if (!username || !password) {
        return { error: 'Please fill in all fields' }
    }

    // 2. Resolve the Email from the Profiles table
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('username', username)
        .single()

    // If username doesn't exist or there is a DB error
    if (profileError || !profile?.email) {
        console.error('Username resolution error:', profileError)
        return { error: 'User not found' }
    }

    // 3. Perform the actual Auth using the resolved email
    const { error: authError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: password,
    })

    if (authError) {
        return { error: 'Invalid username or password' }
    }

    // 4. On success, redirect to the home screen
    return redirect('/')
}