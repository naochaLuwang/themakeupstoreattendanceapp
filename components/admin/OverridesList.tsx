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
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // 1. Remove the accidental check-out to allow shift continuation
        await supabase.from('attendance')
            .update({ check_out: null, is_auto_checkout: false })
            .eq('employee_id', request.requestor_id)
            .gte('check_in', `${today}T00:00:00Z`);

        // 2. Mark request as approved
        await supabase.from('swap_requests')
            .update({ status: 'approved' })
            .eq('id', request.id);

        fetchOverrides();
    };

    if (loading) return <div className="p-8 text-slate-500 font-medium">Checking system logs...</div>;

    if (overrides.length === 0) {
        return (
            <div className="py-24 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="text-slate-200" size={32} />
                </div>
                <p className="text-sm font-medium text-slate-500 tracking-normal">All Systems Clear</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {overrides.map(req => (
                <div key={req.id} className="bg-rose-50/40 p-6 rounded-xl border border-rose-100 flex flex-col md:flex-row items-center justify-between gap-6 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-rose-500 text-white rounded-xl flex items-center justify-center">
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-900">{req.profiles?.full_name}</p>
                            <p className="text-xs text-rose-600 font-medium mt-0.5">{req.message}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => handleApprove(req)}
                        className="w-full md:w-auto bg-slate-900 text-white px-8 py-4 rounded-xl text-sm font-medium tracking-normal hover:bg-slate-800 transition-colors"
                    >
                        Approve Re-Entry
                    </button>
                </div>
            ))}
        </div>
    );
}
