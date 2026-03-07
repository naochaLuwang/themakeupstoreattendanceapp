'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Check, X, Clock, ArrowRight, RefreshCcw,
    User, Calendar, AlertCircle, Loader2, History, Inbox, Search
} from 'lucide-react';

type TabType = 'pending' | 'history';

export default function AdminRequestManager() {
    const supabase = createClient();
    const [requests, setRequests] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('pending');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchRequests = useCallback(async () => {
        const { data, error } = await supabase
            .from('swap_requests')
            .select(`
                *,
                requestor:profiles!requestor_id(full_name),
                receiver:profiles!receiver_id(full_name),
                shifts(*)
            `)
            .order('created_at', { ascending: false });

        if (!error) {
            setRequests(data || []);
        } else {
            console.error("Fetch error:", error);
        }
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchRequests();

        const channel = supabase
            .channel('admin_audit_v4')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests' }, () => {
                fetchRequests();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchRequests, supabase]);

    const handleAction = async (request: any, action: 'approved' | 'declined') => {
        setProcessingId(request.id);

        try {
            if (action === 'approved' && request.shifts) {
                const isSelf = request.requestor_id === request.receiver_id;

                if (isSelf) {
                    const dateMatch = request.message.match(/(\d{4}-\d{2}-\d{2})/g);
                    if (dateMatch && dateMatch.length === 2) {
                        const newWorkDate = dateMatch[0];
                        const oldWorkDate = dateMatch[1];
                        const newStart = request.shifts.start_time.replace(oldWorkDate, newWorkDate);
                        const newEnd = request.shifts.end_time.replace(oldWorkDate, newWorkDate);

                        const { error: shiftErr } = await supabase.from('shifts').update({
                            start_time: newStart,
                            end_time: newEnd,
                            status: 'scheduled'
                        }).eq('id', request.shift_id);

                        if (shiftErr) throw shiftErr;
                    }
                } else {
                    const { error: peerErr } = await supabase.from('shifts').update({
                        employee_id: request.receiver_id
                    }).eq('id', request.shift_id);

                    if (peerErr) throw peerErr;
                }
            }

            // Update DB Status - Matches your DB enum: 'pending', 'approved', 'declined'
            const { error: statusError } = await supabase
                .from('swap_requests')
                .update({ status: action })
                .eq('id', request.id);

            if (statusError) throw statusError;

            // Manual State Transition to keep UI fast and joined data intact
            setRequests(prev => prev.map(r => {
                if (r.id === request.id) {
                    return { ...r, status: action };
                }
                return r;
            }));

        } catch (err: any) {
            console.error("Error updating request:", err);
            alert(`Failed: ${err.message || 'Unknown error'}`);
            fetchRequests(); // Re-sync on failure
        } finally {
            setProcessingId(null);
        }
    };

    // --- Filter Logic ---
    const filteredRequests = requests.filter(req => {
        const reqStatus = (req.status || "").toLowerCase().trim();
        const search = searchQuery.toLowerCase().trim();

        // 1. Tab Filtering (Separates 'pending' from anything else)
        const isInPendingTab = activeTab === 'pending' && reqStatus === 'pending';
        const isInHistoryTab = activeTab === 'history' && reqStatus !== 'pending';

        if (!isInPendingTab && !isInHistoryTab) return false;

        // 2. Search Filtering
        const name = (req.requestor?.full_name || "").toLowerCase();
        return name.includes(search);
    });

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 font-sans pb-32">
            <header className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-medium tracking-tight text-slate-900 leading-none">Request Hub</h1>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Live Admin Dashboard</p>
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-2xl w-fit border border-slate-200/50 shadow-inner">
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                        >
                            Pending
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'}`}
                        >
                            History
                        </button>
                    </div>
                </div>

                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-slate-900 transition-colors" size={16} />
                    <input
                        type="text"
                        placeholder="Search employee by name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-[10px] font-bold uppercase tracking-widest outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
                    />
                </div>
            </header>

            {loading ? (
                <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-slate-200" /></div>
            ) : filteredRequests.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/30">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No {activeTab} entries</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    <AnimatePresence mode="popLayout">
                        {filteredRequests.map((req) => {
                            const isSelf = req.requestor_id === req.receiver_id;
                            const currentStatus = req.status.toLowerCase();
                            const isHistory = currentStatus !== 'pending';

                            return (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    key={req.id}
                                    className={`bg-white border rounded-[2.5rem] p-8 transition-all ${isHistory ? 'border-slate-50 opacity-60 bg-slate-50/20' : 'border-slate-100 shadow-sm'}`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-start gap-6">
                                            <div className={`p-4 rounded-2xl ${isSelf ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                                                {isSelf ? <Calendar size={24} /> : <ArrowRight size={24} />}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-lg font-bold text-slate-900">{req.requestor?.full_name || 'Staff Member'}</span>
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${isSelf ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        {isSelf ? 'Self Move' : 'Peer Trade'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 italic font-medium">{req.message}</p>
                                                <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Requested {new Date(req.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {isHistory ? (
                                                <div className={`px-6 py-3 rounded-full text-[9px] font-black uppercase tracking-widest border flex items-center gap-2 ${currentStatus === 'approved' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-100 text-rose-600'}`}>
                                                    {currentStatus === 'approved' ? <Check size={12} /> : <X size={12} />}
                                                    {currentStatus}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        disabled={!!processingId}
                                                        onClick={() => handleAction(req, 'declined')}
                                                        className="p-4 rounded-2xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-90"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                    <button
                                                        disabled={!!processingId}
                                                        onClick={() => handleAction(req, 'approved')}
                                                        className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-slate-900 text-white hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 active:scale-95"
                                                    >
                                                        {processingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Approve</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}