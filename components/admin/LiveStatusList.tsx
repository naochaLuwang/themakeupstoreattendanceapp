'use client';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function LiveStatusList() {
    const supabase = createClient();
    const [liveAttendance, setLiveAttendance] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLive = async () => {
        const { data } = await supabase
            .from('attendance')
            .select('*, profiles(full_name)')
            .is('check_out', null);
        setLiveAttendance(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchLive();

        // Real-time subscription to update the list when someone clocks in/out
        const channel = supabase.channel('live-updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'attendance'
            }, fetchLive)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    if (loading) return <div className="text-slate-400 text-xs font-bold animate-pulse">Scanning store floor...</div>;

    if (liveAttendance.length === 0) {
        return (
            <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 text-[10px] font-black uppercase tracking-widest">
                No active staff on floor
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveAttendance.map((record) => (
                <div key={record.id} className="p-5 rounded-2xl border border-slate-100 flex items-center gap-4 hover:bg-slate-50 transition-colors shadow-sm bg-white">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-slate-200">
                        {record.profiles?.full_name?.charAt(0)}
                    </div>
                    <div>
                        <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            {record.profiles?.full_name}
                        </p>
                        <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Started: {new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}