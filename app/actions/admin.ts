'use server';

import { z } from 'zod';
import { createServiceClient, getStaffAccess } from '@/lib/admin-client';

const employeeSchema = z.object({
    fullName: z.string().trim().min(1, 'Enter the employee’s full name.').max(150),
    email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.')),
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{1,64}$/, 'Use up to 64 letters, numbers, dots, underscores or hyphens for the username.'),
    password: z.string().min(8, 'Use at least 8 characters for the password.'),
    storeId: z.uuid('Choose a store.'),
});

export async function createNewUser(formData: FormData) {
    const access = await getStaffAccess();
    if (access?.profile?.role !== 'admin') return { error: 'An administrator must create employee accounts.' };

    const parsed = employeeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const { fullName, email, username, password, storeId } = parsed.data;
    if (access.profile.store_id && access.profile.store_id !== storeId) return { error: 'Choose your assigned store.' };

    const { data: store } = await access.client.from('stores').select('id').eq('id', storeId).maybeSingle();
    if (!store) return { error: 'The selected store is unavailable.' };

    const admin = createServiceClient();
    const { data: existing, error: lookupError } = await admin.from('profiles').select('id').eq('username', username).limit(1);
    if (lookupError) return { error: 'Couldn’t check the username. Try again.' };
    if (existing?.length) return { error: 'That username is already in use.' };

    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) return { error: error?.message || 'Couldn’t create the employee login.' };

    const id = data.user.id;
    const { error: profileError } = await admin.from('profiles').upsert({
        id, full_name: fullName, email, username, role: 'employee', store_id: storeId,
    }, { onConflict: 'id' });

    // Verify the exact lookup used at sign-in, including on installations without a unique username index.
    if (!profileError) {
        const { data: login } = await admin.from('profiles').select('id').eq('username', username).single();
        if (login?.id === id) return { success: true, username };
    }
    const { error: cleanupError } = await admin.auth.admin.deleteUser(id);
    if (cleanupError) return { error: 'Account setup is incomplete. Check this email in Supabase Authentication before retrying.' };
    return { error: profileError?.code === '23505' ? 'That username or email is already in use.' : 'Couldn’t finish the employee profile. Check the username and try again.' };
}
