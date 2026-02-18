import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ActivityLogView from './ActivityLogViews';

export default async function LogsWrapper() {
    const supabase = await createClient();

    // Dynamic call is now safely isolated
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    return <ActivityLogView userId={user.id} />;
}