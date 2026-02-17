import { createClient } from '@/lib/supabase/server';
import AttendanceLogTable from '@/components/admin/AttendanceLogTable';
import { redirect } from 'next/navigation';

export default async function AttendanceLogPage() {
    const supabase = await createClient();

    // 1. Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    // 2. Fetch employees for the filter dropdown
    const { data: employees } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'employee')
        .order('full_name');

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <header>
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Attendance Logs</h1>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Audit trail and timecards</p>
            </header>

            <section className="bg-white border border-slate-200 rounded-[3rem] p-6 md:p-10 shadow-xl shadow-slate-100/50">
                <AttendanceLogTable employees={employees || []} />
            </section>
        </div>
    );
}