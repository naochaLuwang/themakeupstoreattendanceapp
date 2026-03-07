'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Play, ShieldAlert, Users, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function AttendanceOversight() {
    const supabase = createClient();
    const [stats, setStats] = useState({ active: 0, autoChecked: 0 });
    const [isRunning, setIsRunning] = useState(false);

    const fetchStats = async () => {
        const { count: active } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .is('check_out', null);

        const { count: auto } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('is_auto_checkout', true);

        setStats({ active: active || 0, autoChecked: auto || 0 });
    };

    useEffect(() => { fetchStats(); }, []);

    const runAutoCheckoutJob = async () => {
        setIsRunning(true);
        const { data, error } = await supabase.rpc('manual_trigger_checkout');

        if (error) {
            toast.error("System Error: " + error.message);
        } else {
            toast.success(`Success: ${data.records_updated} sessions closed.`);
            fetchStats();
        }
        setIsRunning(false);
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto p-4">
            {/* System Status Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <Users className="text-slate-400" size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">On_Duty</span>
                    </div>
                    <p className="text-3xl font-black text-slate-900">{stats.active}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <ShieldAlert className="text-amber-500" size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Auto_Closed</span>
                    </div>
                    <p className="text-3xl font-black text-slate-900">{stats.autoChecked}</p>
                </div>
            </div>

            {/* THE CRON TRIGGER BUTTON */}
            <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h4 className="text-sm font-black uppercase tracking-[0.2em]">Maintenance_Protocol</h4>
                        <p className="text-[10px] text-white/40 font-bold uppercase mt-1">Force Run Stale Session Cleanup</p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-2xl">
                        <Play size={20} className="text-white" />
                    </div>
                </div>

                <button
                    onClick={runAutoCheckoutJob}
                    disabled={isRunning}
                    className="w-full bg-white text-slate-900 py-5 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                >
                    {isRunning ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                    {isRunning ? "Running Logic..." : "Execute Auto-Checkout"}
                </button>

                <p className="text-center text-[8px] text-white/20 uppercase font-black tracking-[0.3em] mt-6 italic">
                    Note: This triggers the same logic as the hourly server cron.
                </p>
            </div>
        </div>
    );
}