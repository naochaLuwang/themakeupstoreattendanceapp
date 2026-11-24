import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import EmployeeShiftView from './EmployeeShiftView';

export default async function EmployeeDashboardContent() {
    const supabase = await createClient();

    // These calls are dynamic and "suspend" the component
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

    return <EmployeeShiftView userId={user.id} firstName={profile?.full_name?.trim().split(/\s+/)[0] || 'there'} />;
}
