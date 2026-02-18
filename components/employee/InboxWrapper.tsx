import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SwapInbox from './SwapInbox';

export default async function InboxWrapper() {
    const supabase = await createClient();

    // This dynamic call is now safely inside a Suspense boundary
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    return <SwapInbox userId={user.id} />;
}