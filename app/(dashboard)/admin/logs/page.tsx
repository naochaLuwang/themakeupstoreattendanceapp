import { createClient } from '@/lib/supabase/server';
import AttendanceLogTable from '@/components/admin/AttendanceLogTable';
import { redirect } from 'next/navigation';
import { ShieldCheck, Database } from 'lucide-react';

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
        <div className="space-y-10 animate-in fade-in duration-700 max-w-7xl mx-auto pb-32">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck size={16} className="text-indigo-500" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">System_Archive</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">Attendance Logs</h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Comprehensive audit trail and timecards</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                    <Database size={16} className="text-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Database Synced</span>
                </div>
            </header>

            <section className="bg-white border border-slate-100 rounded-[2.5rem] md:rounded-[3rem] p-4 md:p-8 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 opacity-20" />
                <AttendanceLogTable employees={employees || []} />
            </section>
        </div>
    );
}