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

    return (
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-700 space-y-6">
            <h2 className="text-xl font-bold text-slate-400 -mt-4">
                Welcome back, {profile?.full_name?.split(' ')[0]}
            </h2>

            <EmployeeShiftView userId={user.id} />

            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center">
                <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Store Status</p>
                    <p className="text-sm font-bold text-slate-900">Makeup Store Main</p>
                </div>
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
        </div>
    );
}