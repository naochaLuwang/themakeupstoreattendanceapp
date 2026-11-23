'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Inbox, ArrowDownLeft, ArrowUpRight,
    Check, X, Clock, Loader2, MessageSquare, RefreshCcw, ShieldCheck
} from 'lucide-react';

export default function SwapInbox({ userId }: { userId: string }) {
    const supabase = createClient();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = useCallback(async () => {
        setLoading(true);

        const { data, error } = await supabase
            .from('swap_requests')
            .select(`
                *,
                requestor:profiles!requestor_id(full_name),
                receiver:profiles!receiver_id(full_name),
                shift:shifts(*)
            `)
            .eq('requestor_id', userId)
            .order('created_at', { ascending: false });

        if (!error) setRequests(data || []);
        setLoading(false);
    }, [userId, supabase]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleAction = async (request: any, newStatus: 'approved' | 'declined') => {
        if (newStatus === 'declined') {
            await supabase.from('swap_requests').update({ status: 'declined' }).eq('id', request.id);
            fetchRequests();
            return;
        }

        const d = new Date(request.shift?.start_time);
        const shiftDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        // Find the user's corresponding shift on that day to interchange
        const { data: userShift, error: findError } = await supabase
            .from('shifts')
            .select('id')
            .eq('employee_id', userId)
            .filter('start_time', 'gte', `${shiftDate}T00:00:00Z`)
            .filter('start_time', 'lte', `${shiftDate}T23:59:59Z`)
            .maybeSingle();

        if (findError || !userShift) {
            alert("Shift mismatch: You don't have a record on this day to interchange.");
            return;
        }

        // Atomic peer swap logic
        const { error: err1 } = await supabase.from('shifts').update({ employee_id: userId }).eq('id', request.shift_id);
        const { error: err2 } = await supabase.from('shifts').update({ employee_id: request.requestor_id }).eq('id', userShift.id);

        if (!err1 && !err2) {
            await supabase.from('swap_requests').update({ status: 'approved' }).eq('id', request.id);
            fetchRequests();
        } else {
            alert("Swap failed. Please try again.");
        }
    };

    return (
        <div className="space-y-6">
            <header className="space-y-2">
                <div className="flex items-center  gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-slate-900" />
                    <span className="text-sm font-medium tracking-normal text-slate-500">Shift requests</span>
                </div>
                <h1 className="text-3xl font-medium text-slate-900">Inbox</h1>
            </header>

            <div className="space-y-4">
                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
                ) : requests.length > 0 ? (
                    <>
                        {requests.map((req) => {
                            const isSelfInterchange = req.requestor_id === req.receiver_id;

                            return (
                                <div
                                    key={req.id}
                                    className="bg-white border border-slate-100 p-6 rounded-xl shadow-sm"
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                                                ${isSelfInterchange ? 'bg-indigo-50 text-indigo-500' : 'bg-slate-50 text-slate-500'}`}>
                                                {isSelfInterchange ? <ShieldCheck size={20} /> : <ArrowUpRight size={20} />}
                                            </div>
                                            <div>
                                                <p className="text-xs font-medium text-slate-500 tracking-normal leading-none mb-1">
                                                    {isSelfInterchange ? 'Awaiting admin review' : 'Sent to colleague'}
                                                </p>
                                                <p className="text-sm font-medium text-slate-900">
                                                    {isSelfInterchange ? 'Shift change request' : req.receiver?.full_name}
                                                </p>
                                            </div>
                                        </div>
                                        <StatusBadge status={req.status} />
                                    </div>

                                    <div className="bg-slate-50 rounded-xl p-5 mb-6 space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Clock size={14} className="text-slate-500" />
                                            <span className="text-sm font-medium text-slate-600 tracking-normal">
                                                {new Date(req.shift?.start_time).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        {req.message && (
                                            <div className="flex items-start gap-2 pt-2 border-t border-slate-200/50">
                                                <MessageSquare size={14} className="text-slate-500 mt-0.5 shrink-0" />
                                                <div className="flex-1 space-y-2">
                                                    <p className="text-xs text-slate-500 leading-relaxed">"{req.message}"</p>
                                                    {req.note && (
                                                        <div className="bg-white border text-left border-gray-100 rounded-lg p-2.5">
                                                            <p className="text-xs font-medium text-slate-500 tracking-normal mb-1">Reason</p>
                                                            <p className="text-sm font-medium text-slate-600">"{req.note}"</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                </div>
                            );
                        })}
                    </>
                ) : (
                    <div className="text-center py-12 rounded-xl border border-slate-200 bg-white">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                            <Inbox size={24} />
                        </div>
                        <p className="text-sm font-medium text-slate-500 tracking-normal">No shift requests yet</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const s = status.toLowerCase();
    const styles: any = {
        pending: 'bg-amber-50 text-amber-600 border-amber-100',
        approved: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        declined: 'bg-rose-50 text-rose-600 border-rose-100',
    };
    return (
        <span className={`px-3 py-1.5 rounded-full text-xs font-medium  tracking-normal border ${styles[s] || styles.pending}`}>
            {s}
        </span>
    );
}
