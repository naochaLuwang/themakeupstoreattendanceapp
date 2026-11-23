import { createClient } from '@/lib/supabase/server';
import AttendanceTabs from '@/components/admin/AttendanceTabs';
import { redirect } from 'next/navigation';
import { ShieldCheck, Database } from 'lucide-react';

export default async function AttendanceLogPage() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: employees } = await supabase
        .from('profiles')
        .select('id, full_name, store_id')
        .eq('role', 'employee')
        .order('full_name');

    return (
        <div className="space-y-10 max-w-7xl mx-auto">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck size={16} className="text-indigo-500" />
                        <span className="text-sm font-medium tracking-normal text-indigo-400">Attendance records</span>
                    </div>
                    <h1 className="text-3xl md:text-3xl font-medium text-slate-900 tracking-normal">Attendance logs</h1>
                    <p className="text-xs font-medium text-slate-500 tracking-normal mt-2">Review timecards, clock-ins, and attendance history</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl border border-slate-100 shadow-sm">
                    <Database size={16} className="text-slate-500" />
                    <span className="text-sm font-medium tracking-normal text-slate-600">Attendance history</span>
                </div>
            </header>

            <section className="bg-white border border-slate-100 rounded-xl md:rounded-xl p-4 md:p-8 relative overflow-hidden">

                <AttendanceTabs employees={employees || []} />
            </section>
        </div>
    );
}
