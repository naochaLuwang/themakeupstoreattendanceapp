import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { INSTALLATION_COOKIE, notificationUser } from '@/lib/notifications/server';
import { validDeviceCredential } from '@/lib/security/opaque-credential';

export async function POST() {
    const supabase = await createClient();

    // 1. Check if a user session exists before trying to sign out
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        const credential = (await cookies()).get(INSTALLATION_COOKIE)?.value;
        // A delivery already accepted by an OS/provider cannot be recalled.
        // Generic push text and authenticated destinations protect signed-out use.
        if (validDeviceCredential(credential)) {
            try { await notificationUser({ action: 'detach' }, credential, user.id); } catch { /* Never trap the user in a signed-in session. */ }
        }
        await supabase.auth.signOut();
    }

    // 2. Redirect back to the login page
    redirect('/login');
}
