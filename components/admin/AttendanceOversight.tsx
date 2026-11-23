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
            toast.success(`Auto-checkout completed.`);
            fetchStats();
        }
        setIsRunning(false);
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto p-4">
            {/* System Status Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <Users className="text-slate-500" size={16} />
                        <span className="text-sm font-medium tracking-normal text-slate-500">On duty</span>
                    </div>
                    <p className="text-3xl font-medium text-slate-900">{stats.active}</p>
                </div>
                <div className="bg-white border border-slate-100 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <ShieldAlert className="text-amber-500" size={16} />
                        <span className="text-sm font-medium tracking-normal text-amber-500">Automatically closed</span>
                    </div>
                    <p className="text-3xl font-medium text-slate-900">{stats.autoChecked}</p>
                </div>
            </div>

            {/* THE CRON TRIGGER BUTTON */}
            {/* <div className="bg-slate-900 rounded-xl p-8 text-white">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h4 className="text-sm font-medium tracking-normal">Maintenance_Protocol</h4>
                        <p className="text-sm text-white/40 font-medium mt-1">Force Run Stale Session Cleanup</p>
                    </div>
                    <div className="p-3 bg-white/10 rounded-xl">
                        <Play size={20} className="text-white" />
                    </div>
                </div>

                <button
                    onClick={runAutoCheckoutJob}
                    disabled={isRunning}
                    className="w-full bg-white text-slate-900 py-5 rounded-xl text-xs font-medium tracking-normal hover:bg-slate-100 transition-colors flex items-center justify-center gap-3"
                >
                    {isRunning ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                    {isRunning ? "Running Logic..." : "Execute Auto-Checkout"}
                </button>

                <p className="text-center text-xs text-white/20 font-medium tracking-normal mt-6">
                    Note: This triggers the same logic as the hourly server cron.
                </p>
            </div> */}

            {/* Active Personnel List */}
            {activeEmployees.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mt-6">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="text-sm font-medium tracking-normal text-slate-800">Staff on duty</h4>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {activeEmployees.map(emp => (
                            <div key={emp.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                <div>
                                    <p className="font-medium text-slate-900">{emp.profiles?.full_name || 'Unknown'}</p>
                                    <p className="text-sm font-medium text-slate-500 tracking-normal mt-1">
                                        In: {new Date(emp.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleForceCheckout(emp.id)}
                                    className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium tracking-normal hover:bg-rose-100 transition-colors outline-none"
                                >
                                    Force clock-out
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
