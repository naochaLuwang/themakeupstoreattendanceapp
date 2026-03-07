import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AttendanceOversight from '@/components/admin/AttendanceOversight';
import { ShieldCheck, Activity } from 'lucide-react';

export default async function OversightPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Security Gate: Ensure only admins can access this page
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

    if (!user || profile?.role !== 'admin') {
        redirect('/');
    }

    return (
        <div className="min-h-screen bg-[#FAFAFA] pb-20">
            {/* ADMIN HEADER */}
            <div className="bg-white border-b border-slate-100 px-8 py-10">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck size={14} className="text-slate-900" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                                System_Administration
                            </span>
                        </div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase text-slate-900">
                            Oversight Console
                        </h1>
                    </div>
                    <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl flex items-center gap-2 border border-emerald-100">
                        <Activity size={14} className="animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Live_Nodes</span>
                    </div>
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="mt-10">
                <AttendanceOversight />
            </div>

            {/* LOGS / INFO SECTION */}
            <div className="max-w-2xl mx-auto px-4 mt-8">
                <div className="bg-white border border-slate-100 rounded-[2rem] p-8">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
                        Protocol_Information
                    </h5>
                    <ul className="space-y-4">
                        <li className="flex gap-4 items-start">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-1.5 shrink-0" />
                            <p className="text-xs font-medium text-slate-600 leading-relaxed">
                                The <span className="font-black text-slate-900">Auto-Checkout</span> protocol closes attendance sessions that exceed the scheduled end-time by 2 hours.
                            </p>
                        </li>
                        <li className="flex gap-4 items-start">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-200 mt-1.5 shrink-0" />
                            <p className="text-xs font-medium text-slate-600 leading-relaxed">
                                Manual execution syncs the database immediately and bypasses the 60-minute cron interval.
                            </p>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}