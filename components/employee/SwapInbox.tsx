'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Inbox, ArrowUpRight,
    Clock, Loader2, MessageSquare, ShieldCheck
} from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';
type RequestRow = Database['public']['Tables']['swap_requests']['Row'] & {
    requestor: { full_name: string | null } | null;
    receiver: { full_name: string | null } | null;
    shift: Database['public']['Tables']['shifts']['Row'] | null;
};

export default function SwapInbox({ userId }: { userId: string }) {
    const supabase = createClient();
    const [requests, setRequests] = useState<RequestRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

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

        setLoadError(Boolean(error));
        if (!error) setRequests((data || []) as unknown as RequestRow[]);
        setLoading(false);
    }, [userId, supabase]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);


    return (
        <div className="employee-screen employee-inbox-screen space-y-6">
            <header className="employee-page-heading space-y-2">
                <div className="flex items-center  gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-slate-900" />
                    <span className="text-sm font-medium tracking-normal text-slate-500">Shift requests</span>
                </div>
                <h1 className="text-3xl font-medium text-slate-900">Inbox</h1>
            </header>

            <div className="employee-inbox-list space-y-4">
                {loadError ? (
                    <p role="alert">Couldn’t load shift requests. <button type="button" onClick={() => void fetchRequests()} className="underline">Retry</button></p>
                ) : loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
                ) : requests.length > 0 ? (
                    <>
                        {requests.map((req) => {
                            const isSelfInterchange = req.requestor_id === req.receiver_id;

                            return (
                                <div
                                    key={req.id}
                                    className="employee-inbox-record bg-white border border-slate-100 p-6 rounded-xl shadow-sm"
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
                                                {new Date(req.shift?.start_time || '').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                        {req.message && (
                                            <div className="flex items-start gap-2 pt-2 border-t border-slate-200/50">
                                                <MessageSquare size={14} className="text-slate-500 mt-0.5 shrink-0" />
                                                <div className="flex-1 space-y-2">
                                                    <p className="text-xs text-slate-500 leading-relaxed">&ldquo;{req.message}&rdquo;</p>
                                                    {req.note && (
                                                        <div className="bg-white border text-left border-gray-100 rounded-lg p-2.5">
                                                            <p className="text-xs font-medium text-slate-500 tracking-normal mb-1">Reason</p>
                                                            <p className="text-sm font-medium text-slate-600">&ldquo;{req.note}&rdquo;</p>
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
    const styles: Record<string, string> = {
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
