'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Check, X, Clock, ArrowRight, RefreshCcw,
    Calendar, Search, Loader2, ArrowLeftRight
} from 'lucide-react';
import { approveOverrideRequest } from '@/app/actions/attendance-override';
import { reviewShiftRequestAction } from '@/app/actions/shifts';
import { SHIFT_LOCK_MESSAGE } from '@/lib/shifts/rules';
import type { Database } from '@/lib/supabase/database.types';

type RequestRow = Database['public']['Tables']['swap_requests']['Row'] & {
    requestor: { full_name: string | null } | null;
    receiver: { full_name: string | null } | null;
    shifts: Database['public']['Tables']['shifts']['Row'] | null;
};

export default function AdminRequestManager() {
    const supabase = createClient();
    const [requests, setRequests] = useState<RequestRow[]>([]);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchRequests = useCallback(async () => {
        const { data, error } = await supabase
            .from('swap_requests')
            .select(`*, requestor:profiles!requestor_id(full_name), receiver:profiles!receiver_id(full_name), shifts(*)`)
            .order('created_at', { ascending: false });
        if (!error) setRequests((data || []) as unknown as RequestRow[]);
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchRequests();
        const channel = supabase.channel('admin_request_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests' }, () => fetchRequests())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchRequests, supabase]);

    const handleAction = async (request: RequestRow, action: 'approved' | 'declined') => {
        if (processingId) return;
        setProcessingId(request.id);
        try {
            const result = action === 'approved' && request.message?.startsWith('OVERRIDE REQUEST')
                ? await approveOverrideRequest(request.id)
                : await reviewShiftRequestAction(request.id, action);
            if (!result.success) throw new Error(result.error);
            await fetchRequests();
        } catch (error: unknown) {
            alert(error instanceof Error ? error.message : 'Could not review this request.');
            await fetchRequests();
        } finally {
            setProcessingId(null);
        }
    };

    const filtered = requests.filter(req => {
        const matchesTab = activeTab === 'pending'
            ? req.status === 'pending'
            : req.status !== 'pending';
        const nameMatch = req.requestor?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && nameMatch;
    });

    const getRequestType = (req: RequestRow) => {
        const isSelf = req.requestor_id === req.receiver_id;
        const msg = req.message || '';
        if (!isSelf) return { type: 'Peer Swap', icon: <ArrowLeftRight size={20} />, color: 'bg-emerald-50 text-emerald-600' };
        if (msg.includes('Shift Change')) return { type: 'Shift Change', icon: <RefreshCcw size={20} />, color: 'bg-blue-50 text-blue-600' };
        if (msg.includes('Week Off Change')) return { type: 'Week Off Move', icon: <Calendar size={20} />, color: 'bg-amber-50 text-amber-600' };
        return { type: 'Shift Interchange', icon: <ArrowRight size={20} />, color: 'bg-indigo-50 text-indigo-500' };
    };

    const getStatusStyle = (status: string) => {
        const s = status.toLowerCase();
        if (s === 'approved') return 'bg-emerald-50 border-emerald-100 text-emerald-600';
        if (s === 'declined') return 'bg-rose-50 border-rose-100 text-rose-600';
        if (s === 'cancelled') return 'bg-slate-50 border-slate-200 text-slate-500';
        return 'bg-amber-50 border-amber-100 text-amber-600';
    };

    return (
        <div className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-medium tracking-normal text-slate-900">Swap requests</h1>
                    <p className="text-sm font-medium text-slate-500 tracking-normal flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Shift swaps and change requests
                    </p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                    <button onClick={() => setActiveTab('pending')} className={`px-8 py-2.5 rounded-xl text-sm font-medium  tracking-normal transition-colors ${activeTab === 'pending' ? 'bg-white  text-slate-900' : 'text-slate-500'}`}>
                        Pending ({requests.filter(r => r.status === 'pending').length})
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`px-8 py-2.5 rounded-xl text-sm font-medium  tracking-normal transition-colors ${activeTab === 'history' ? 'bg-white  text-slate-900' : 'text-slate-500'}`}>
                        History
                    </button>
                </div>
            </header>

            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input type="text" placeholder="Search staff" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-slate-900/5" />
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center gap-4 ">
                    <Loader2 className="animate-spin" size={24} />
                    <p className="text-sm font-medium tracking-normal">Loading requests...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-24 text-center border border-dashed border-slate-100 rounded-xl">
                    <p className="text-sm font-medium text-slate-500 tracking-normal">
                        {activeTab === 'pending' ? 'No pending requests' : 'No history found'}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    <>
                        {filtered.map((req) => {
                            const reqType = getRequestType(req);
                            return (
                                <div key={req.id}
                                    className={`bg-white border rounded-xl p-8 transition-colors ${req.status !== 'pending' ? '' : 'border-slate-100 shadow-sm '}`}>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-start gap-5">
                                            <div className={`p-4 rounded-xl shrink-0 ${reqType.color}`}>
                                                {reqType.icon}
                                            </div>
                                            <div className="space-y-2 min-w-0 flex-1">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <span className="text-lg font-medium text-slate-900">{req.requestor?.full_name}</span>
                                                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 shrink-0">
                                                        {reqType.type}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 font-medium leading-relaxed">&ldquo;{req.message}&rdquo;</p>
                                                {req.note && (
                                                    <div className="mt-2 bg-slate-50/80 border border-slate-100/80 rounded-xl p-3">
                                                        <p className="text-xs font-medium text-slate-500 tracking-normal mb-1.5">Employee Note</p>
                                                        <p className="text-xs font-medium text-slate-600">&ldquo;{req.note}&rdquo;</p>
                                                    </div>
                                                )}
                                                {req.shifts && (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Clock size={12} className="text-slate-500" />
                                                        <span className="text-sm font-medium text-slate-500">
                                                            Shift: {new Date(req.shifts.start_time).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                            {req.shifts.shift_label && <span className="ml-2 text-slate-500">({req.shifts.shift_label})</span>}
                                                        </span>
                                                    </div>
                                                )}
                                                {req.requestor_id !== req.receiver_id && req.receiver?.full_name && (
                                                    <div className="flex items-center gap-2">
                                                        <ArrowRight size={12} className="text-slate-500" />
                                                        <span className="text-sm font-medium text-slate-500">To: {req.receiver.full_name}</span>
                                                    </div>
                                                )}
                                                <p className="text-xs text-slate-500 font-medium">
                                                    {new Date(req.created_at || '').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {req.status === 'pending' ? (
                                                <>
                                                    <button disabled={Boolean(processingId)} aria-label="Decline request" onClick={() => handleAction(req, 'declined')}
                                                        className="p-4 rounded-xl bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-colors">
                                                        <X size={20} />
                                                    </button>
                                                    <button disabled={Boolean(processingId) || Boolean(req.shifts?.attendance_started_at && !req.message?.startsWith('OVERRIDE REQUEST'))} title={req.shifts?.attendance_started_at && !req.message?.startsWith('OVERRIDE REQUEST') ? SHIFT_LOCK_MESSAGE : undefined} aria-label="Approve request" onClick={() => handleAction(req, 'approved')}
                                                        className="flex items-center gap-3 px-8 py-4 rounded-xl bg-slate-900 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50">
                                                        {processingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                        <span className="text-sm font-medium tracking-normal">Approve</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <div className={`px-6 py-3 rounded-full text-xs font-medium  border ${getStatusStyle(req.status)}`}>
                                                    {req.status}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </>
                </div>
            )}
        </div>
    );
}
