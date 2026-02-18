import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LeaveRequestView from './LeaveRequestView';

export default async function LeaveWrapper() {
    const supabase = await createClient();

    // Auth check is now isolated inside the Suspense boundary
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    return <LeaveRequestView userId={user.id} />;
}