import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import EmployeeShiftView from './EmployeeShiftView';
import EmployeeStoreOpsNav from './EmployeeStoreOpsNav';

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

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-medium text-slate-900">My shifts</h1>
                <p className="mt-2 text-sm text-slate-500">{profile?.full_name || 'Your schedule'} · Shifts and attendance</p>
            </header>
            <EmployeeShiftView userId={user.id} />
            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <h2 className="text-lg font-medium text-slate-900">Store operations</h2>
                <p className="text-sm text-slate-500">Daily checks, reports, and assigned work</p>
                <EmployeeStoreOpsNav />
            </section>
        </div>
    );
}
