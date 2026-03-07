'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Inbox, ArrowDownLeft, ArrowUpRight,
    Check, X, Clock, Loader2, MessageSquare
} from 'lucide-react';

export default function SwapInbox({ userId }: { userId: string }) {
    const supabase = createClient();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'received' | 'sent'>('received');

    useEffect(() => {
        fetchRequests();
    }, [userId, filter]);

    const fetchRequests = async () => {
        setLoading(true);
        const isReceived = filter === 'received';

        // THE FIX: Added .neq('requestor_id', 'receiver_id') 
        // This filters out "Self-Swaps" (Week Off changes) from the peer inbox.
        const { data, error } = await supabase
            .from('swap_requests')
            .select(`
                *,
                requestor:profiles!swap_requests_requestor_id_fkey(full_name),
                receiver:profiles!swap_requests_receiver_id_fkey(full_name),
                shift:shifts(*)
            `)
            .eq(isReceived ? 'receiver_id' : 'requestor_id', userId)
            .neq('requestor_id', 'receiver_id') // Filter out self-requests
            .order('created_at', { ascending: false });

        if (!error) setRequests(data || []);
        setLoading(false);
    };

    const handleAction = async (request: any, newStatus: 'approved' | 'rejected') => {
        if (newStatus === 'rejected') {
            await supabase.from('swap_requests').update({ status: 'rejected' }).eq('id', request.id);
            fetchRequests();
            return;
        }

        // --- PEER INTERCHANGE LOGIC ---
        // 

        const shiftDate = new Date(request.shift?.start_time).toISOString().split('T')[0];

        // Find the receiver's shift to swap back to the requestor
        const { data: receiverShift, error: findError } = await supabase
            .from('shifts')
            .select('id')
            .eq('employee_id', userId)
            .filter('start_time', 'gte', `${shiftDate}T00:00:00Z`)
            .filter('start_time', 'lte', `${shiftDate}T23:59:59Z`)
            .maybeSingle();

        if (findError || !receiverShift) {
            alert("You don't have a shift on this day to interchange with!");
            return;
        }

        // Execute the atomic swap
        const { error: err1 } = await supabase
            .from('shifts')
            .update({ employee_id: userId })
            .eq('id', request.shift_id);

        const { error: err2 } = await supabase
            .from('shifts')
            .update({ employee_id: request.requestor_id })
            .eq('id', receiverShift.id);

        if (!err1 && !err2) {
            await supabase.from('swap_requests').update({ status: 'approved' }).eq('id', request.id);
            fetchRequests();
        } else {
            alert("Interchange failed.");
        }
    };

    return (
        <div className="px-6 pt-10 pb-24 max-w-md mx-auto font-sans">
            <header className="mb-8">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Peer Network</span>
                </div>
                <h2 className="text-3xl font-medium text-slate-900 tracking-tight">Shift Inbox</h2>

                <div className="flex gap-6 mt-6 border-b border-slate-100">
                    <TabBtn active={filter === 'received'} label="Received" onClick={() => setFilter('received')} />
                    <TabBtn active={filter === 'sent'} label="Sent" onClick={() => setFilter('sent')} />
                </div>
            </header>

            <div className="space-y-4">
                {loading ? (
                    <div className="flex justify-center py-20 opacity-20"><Loader2 className="animate-spin" /></div>
                ) : requests.length > 0 ? (
                    <AnimatePresence>
                        {requests.map((req) => (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                key={req.id}
                                className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center ${filter === 'received' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                                            {filter === 'received' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">
                                                {filter === 'received' ? 'Request From' : 'Sent To'}
                                            </p>
                                            <p className="text-sm font-bold text-slate-900">
                                                {filter === 'received' ? req.requestor?.full_name : req.receiver?.full_name}
                                            </p>
                                        </div>
                                    </div>
                                    <StatusBadge status={req.status} />
                                </div>

                                <div className="bg-slate-50 rounded-3xl p-5 mb-6 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} className="text-slate-400" />
                                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                            {new Date(req.shift?.start_time).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        </span>
                                    </div>
                                    {req.message && (
                                        <div className="flex items-start gap-2 pt-2 border-t border-slate-200/50">
                                            <MessageSquare size={14} className="text-slate-300 mt-0.5" />
                                            <p className="text-xs text-slate-500 leading-relaxed italic">"{req.message}"</p>
                                        </div>
                                    )}
                                </div>

                                {filter === 'received' && req.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAction(req, 'approved')}
                                            className="flex-1 bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-slate-200"
                                        >
                                            Accept Trade
                                        </button>
                                        <button
                                            onClick={() => handleAction(req, 'rejected')}
                                            className="p-4 bg-white border border-slate-100 text-rose-500 rounded-2xl active:scale-90 transition-all"
                                        >
                                            <X size={18} />
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                ) : (
                    <div className="text-center py-24">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Inbox size={24} className="text-slate-200" />
                        </div>
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Inbox is empty</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function TabBtn({ label, active, onClick }: any) {
    return (
        <button onClick={onClick} className={`pb-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${active ? 'text-slate-900' : 'text-slate-300 hover:text-slate-400'}`}>
            {label}
            {active && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900" />}
        </button>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: any = {
        pending: 'bg-amber-50 text-amber-600 border-amber-100',
        approved: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        rejected: 'bg-rose-50 text-rose-600 border-rose-100',
    };
    return (
        <span className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${styles[status] || styles.pending}`}>
            {status}
        </span>
    );
}