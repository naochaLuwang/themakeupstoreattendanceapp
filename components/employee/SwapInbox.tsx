'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Inbox, ArrowUpRight, ArrowDownLeft,
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

        const { data, error } = await supabase
            .from('swap_requests')
            .select(`
                *,
                requestor:profiles!swap_requests_requestor_id_fkey(full_name),
                receiver:profiles!swap_requests_receiver_id_fkey(full_name),
                shift:shifts(*)
            `)
            .eq(isReceived ? 'receiver_id' : 'requestor_id', userId)
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

        // --- INTERCHANGE LOGIC ---

        // 1. Identify the date of the requestor's shift
        const shiftDate = new Date(request.shift?.start_time).toISOString().split('T')[0];

        // 2. Find the receiver's (your) shift on that same day to trade
        const { data: receiverShift, error: findError } = await supabase
            .from('shifts')
            .select('id')
            .eq('employee_id', userId) // userId is the receiver
            .filter('start_time', 'gte', `${shiftDate}T00:00:00Z`)
            .filter('start_time', 'lte', `${shiftDate}T23:59:59Z`)
            .maybeSingle();

        if (findError || !receiverShift) {
            alert("You don't have a shift on this day to interchange with!");
            return;
        }

        // 3. Execute the Swap
        // Shift A (Requestor's) goes to Receiver
        const { error: err1 } = await supabase
            .from('shifts')
            .update({ employee_id: userId })
            .eq('id', request.shift_id);

        // Shift B (Receiver's) goes to Requestor
        const { error: err2 } = await supabase
            .from('shifts')
            .update({ employee_id: request.requestor_id })
            .eq('id', receiverShift.id);

        // 4. Finalize request status
        if (!err1 && !err2) {
            await supabase
                .from('swap_requests')
                .update({ status: 'approved' })
                .eq('id', request.id);

            fetchRequests();
        } else {
            alert("Interchange failed. Check database permissions.");
        }
    };

    return (
        <div className="px-6 pt-10 pb-24 max-w-md mx-auto">
            <header className="mb-8">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Inbox</h2>
                <div className="flex gap-4 mt-4 border-b border-slate-100">
                    <TabBtn active={filter === 'received'} label="Received" onClick={() => setFilter('received')} />
                    <TabBtn active={filter === 'sent'} label="Sent" onClick={() => setFilter('sent')} />
                </div>
            </header>

            <div className="space-y-3">
                {loading ? (
                    <div className="flex justify-center py-20 opacity-20"><Loader2 className="animate-spin" /></div>
                ) : requests.length > 0 ? (
                    requests.map((req) => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                            key={req.id}
                            className="bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${filter === 'received' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-600'}`}>
                                        {filter === 'received' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {filter === 'received' ? 'From' : 'To'}
                                        </p>
                                        <p className="text-sm font-bold text-slate-900">
                                            {filter === 'received' ? req.requestor?.full_name : req.receiver?.full_name}
                                        </p>
                                    </div>
                                </div>
                                <StatusBadge status={req.status} />
                            </div>

                            <div className="bg-slate-50/50 rounded-2xl p-4 mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock size={12} className="text-slate-400" />
                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight">
                                        Shift: {new Date(req.shift?.start_time).toLocaleDateString()}
                                    </span>
                                </div>
                                {req.message && (
                                    <div className="flex items-start gap-2">
                                        <MessageSquare size={12} className="text-slate-400 mt-0.5" />
                                        <p className="text-xs text-slate-500 leading-relaxed italic">"{req.message}"</p>
                                    </div>
                                )}
                            </div>

                            {/* Actions for Received & Pending requests */}
                            {filter === 'received' && req.status === 'pending' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleAction(req, 'approved')}
                                        className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        <Check size={14} /> Accept
                                    </button>
                                    <button
                                        onClick={() => handleAction(req.id, 'rejected')}
                                        className="flex-1 bg-white border border-slate-100 text-rose-500 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                        <X size={14} /> Decline
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))
                ) : (
                    <div className="text-center py-20 opacity-30">
                        <Inbox size={40} className="mx-auto mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">No Requests</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function TabBtn({ label, active, onClick }: any) {
    return (
        <button onClick={onClick} className={`pb-3 text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-300'}`}>
            {label}
        </button>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: any = {
        pending: 'bg-amber-50 text-amber-600',
        approved: 'bg-emerald-50 text-emerald-600',
        rejected: 'bg-rose-50 text-rose-600',
    };
    return (
        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter ${styles[status] || styles.pending}`}>
            {status}
        </span>
    );
}