'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Play, ShieldAlert, Users, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function AttendanceOversight() {
    const supabase = createClient();
    const [stats, setStats] = useState({ active: 0, autoChecked: 0 });
    const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    const fetchStats = async () => {
        const { count: auto } = await supabase
            .from('attendance')
            .select('*', { count: 'exact', head: true })
            .eq('is_auto_checkout', true);

        const { data: activeList } = await supabase
            .from('attendance')
            .select('*, profiles:employee_id(full_name)')
            .is('check_out', null);

        setStats({ active: activeList?.length || 0, autoChecked: auto || 0 });
        setActiveEmployees(activeList || []);
    };

    useEffect(() => { fetchStats(); }, []);

    const handleForceCheckout = async (attendanceId: string) => {
        const { error } = await supabase.from('attendance')
            .update({ check_out: new Date().toISOString() })
            .eq('id', attendanceId);

        if (!error) {
            toast.success("Employee manually clocked out.");
            fetchStats();
        } else {
            toast.error("Failed to clock out employee.");
        }
    };

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
            {/* <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl">
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
            </div> */}

            {/* Active Personnel List */}
            {activeEmployees.length > 0 && (
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden mt-6">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-800">On Duty Personnel</h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {activeEmployees.map(emp => (
                            <div key={emp.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                <div>
                                    <p className="font-bold text-slate-900">{emp.profiles?.full_name || 'Unknown'}</p>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                        In: {new Date(emp.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleForceCheckout(emp.id)}
                                    className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 active:scale-95 transition-all outline-none"
                                >
                                    Force Clock-Out
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}