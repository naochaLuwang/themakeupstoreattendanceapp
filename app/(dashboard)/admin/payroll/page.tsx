import { createClient } from '@/lib/supabase/server';
import PayrollTable from './PayrollTable';
import PayrollHistory from './History';
import AdvanceForm from './AdvanceForm';

export default async function PayrollPage() {
    const supabase = await createClient();

    // Fetch live hours, profiles, and history
    const { data: statsData } = await supabase.from('monthly_employee_stats').select('*');
    const { data: profilesData } = await supabase.from('profiles').select('id, hourly_rate, email, full_name');
    const { data: historyData } = await supabase
        .from('payroll_records')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

    const combinedData = statsData?.map(stat => ({
        ...stat,
        profile: profilesData?.find(p => p.id === stat.employee_id)
    })) || [];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-6xl font-black tracking-tighter italic text-slate-900">Payroll.</h1>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mt-3">Compensation Management</p>
                </div>
                <div className="w-full md:w-96">
                    <AdvanceForm profiles={profilesData || []} />
                </div>
            </header>

            <section>
                <h2 className="text-xs font-black uppercase text-indigo-500 mb-6 tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" /> Pending Settlements
                </h2>
                <PayrollTable initialData={combinedData} history={historyData || []} />
            </section>

            <PayrollHistory history={historyData || []} />
        </div>
    );
}