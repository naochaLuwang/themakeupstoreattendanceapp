'use client';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface OverridesListProps {
    adminId: string;
}

export default function OverridesList({ adminId }: OverridesListProps) {
    const supabase = createClient();
    const [overrides, setOverrides] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOverrides = async () => {
        const { data } = await supabase
            .from('swap_requests')
            .select('*, profiles:requestor_id(full_name)')
            .ilike('message', 'OVERRIDE REQUEST%')
            .eq('status', 'pending');
        setOverrides(data || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchOverrides();

        const channel = supabase.channel('override-sync')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'swap_requests'
            }, fetchOverrides)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleApprove = async (request: any) => {
        const today = new Date().toISOString().split('T')[0];

        // 1. Delete the "stuck" record for today to allow fresh clock-in
        await supabase.from('attendance')
            .delete()
            .eq('employee_id', request.requestor_id)
            .gte('check_in', `${today}T00:00:00Z`);

        // 2. Mark request as approved
        await supabase.from('swap_requests')
            .update({ status: 'approved' })
            .eq('id', request.id);

        fetchOverrides();
    };

    if (loading) return <div className="p-8 text-slate-400 font-bold animate-pulse">Checking system logs...</div>;

    if (overrides.length === 0) {
        return (
            <div className="py-24 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="text-slate-200" size={32} />
                </div>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">All Systems Clear</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {overrides.map(req => (
                <div key={req.id} className="bg-rose-50/40 p-6 rounded-[2rem] border border-rose-100 flex flex-col md:flex-row items-center justify-between gap-6 transition-all hover:shadow-md">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-black text-slate-900 uppercase">{req.profiles?.full_name}</p>
                            <p className="text-xs text-rose-600 font-bold italic mt-0.5">{req.message}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => handleApprove(req)}
                        className="w-full md:w-auto bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-xl shadow-slate-200"
                    >
                        Approve Re-Entry
                    </button>
                </div>
            ))}
        </div>
    );
}