'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Check, X, Clock, ArrowRight, RefreshCcw,
    Calendar, Search, Loader2, ArrowLeftRight, AlertCircle
} from 'lucide-react';

export default function AdminRequestManager() {
    const supabase = createClient();
    const [requests, setRequests] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchRequests = useCallback(async () => {
        const { data, error } = await supabase
            .from('swap_requests')
            .select(`*, requestor:profiles!requestor_id(full_name), receiver:profiles!receiver_id(full_name), shifts(*)`)
            .order('created_at', { ascending: false });
        if (!error) setRequests(data || []);
        setLoading(false);
    }, [supabase]);

    useEffect(() => {
        fetchRequests();
        const channel = supabase.channel('admin_request_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests' }, () => fetchRequests())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchRequests, supabase]);

    const handleAction = async (request: any, action: 'approved' | 'declined') => {
        setProcessingId(request.id);
        try {
            if (action === 'approved' && request.shifts) {
                const isSelf = request.requestor_id === request.receiver_id;
                const msg = request.message || "";

                if (isSelf) {
                    // --- CASE 1: SHIFT TIME CHANGE (same day, different schedule) ---
                    if (msg.includes("Shift Change")) {
                        const labelMatch = msg.match(/to (.+?) for/);
                        const newLabel = labelMatch ? labelMatch[1].trim() : null;
                        if (newLabel) {
                            const { data: preset } = await supabase
                                .from('shift_presets')
                                .select('*')
                                .ilike('label', `%${newLabel}%`)
                                .single();
                            if (preset) {
                                const baseDate = request.shifts.start_time.split('T')[0];
                                const { error } = await supabase.from('shifts').update({
                                    shift_label: preset.label,
                                    start_time: `${baseDate}T${preset.start_time}Z`,
                                    end_time: `${baseDate}T${preset.end_time}Z`
                                }).eq('id', request.shift_id);
                                if (error) throw error;
                            } else {
                                throw new Error(`Shift preset '${newLabel}' not found`);
                            }
                        }
                    }
                    // --- CASE 2: DATE INTERCHANGE (move shift from one date to another) ---
                    else {
                        const dateMatch = msg.match(/(\d{4}-\d{2}-\d{2})/g);
                        if (dateMatch && dateMatch.length === 2) {
                            const sourceDate = dateMatch[0];
                            const targetDate = dateMatch[1];

                            if (msg.includes("Week Off Change")) {
                                // Moving a shift FROM sourceDate TO targetDate (source was OFF, target was WORK)
                                // So shift is on targetDate — move it to sourceDate (make source a work day, target becomes off)
                                const newStart = request.shifts.start_time.replace(targetDate, sourceDate);
                                const newEnd = request.shifts.end_time.replace(targetDate, sourceDate);

                                // Check if the replacement makes sense
                                if (newStart === request.shifts.start_time) {
                                    // Fallback: try the other direction
                                    const altStart = request.shifts.start_time.replace(sourceDate, targetDate);
                                    const altEnd = request.shifts.end_time.replace(sourceDate, targetDate);
                                    const { error } = await supabase.from('shifts').update({
                                        start_time: altStart, end_time: altEnd
                                    }).eq('id', request.shift_id);
                                    if (error) throw error;
                                } else {
                                    const { error } = await supabase.from('shifts').update({
                                        start_time: newStart, end_time: newEnd
                                    }).eq('id', request.shift_id);
                                    if (error) throw error;
                                }
                            } else {
                                // Shift Interchange: swap dates of two shifts
                                // Find both shifts
                                const { data: sourceShift } = await supabase
                                    .from('shifts')
                                    .select('*')
                                    .eq('employee_id', request.requestor_id)
                                    .gte('start_time', `${sourceDate}T00:00:00`)
                                    .lte('start_time', `${sourceDate}T23:59:59`)
                                    .maybeSingle();

                                const { data: targetShift } = await supabase
                                    .from('shifts')
                                    .select('*')
                                    .eq('employee_id', request.requestor_id)
                                    .gte('start_time', `${targetDate}T00:00:00`)
                                    .lte('start_time', `${targetDate}T23:59:59`)
                                    .maybeSingle();

                                if (sourceShift && targetShift) {
                                    // Swap timings between the two shifts
                                    const sourceTime = sourceShift.start_time.split('T')[1];
                                    const sourceEndTime = sourceShift.end_time.split('T')[1];
                                    const targetTime = targetShift.start_time.split('T')[1];
                                    const targetEndTime = targetShift.end_time.split('T')[1];

                                    await supabase.from('shifts').update({
                                        start_time: `${sourceDate}T${targetTime}`,
                                        end_time: `${sourceDate}T${targetEndTime}`,
                                        shift_label: targetShift.shift_label
                                    }).eq('id', sourceShift.id);

                                    await supabase.from('shifts').update({
                                        start_time: `${targetDate}T${sourceTime}`,
                                        end_time: `${targetDate}T${sourceEndTime}`,
                                        shift_label: sourceShift.shift_label
                                    }).eq('id', targetShift.id);
                                } else if (sourceShift || targetShift) {
                                    // One is a work day, one is off — just move the shift
                                    const existingShift = sourceShift || targetShift;
                                    const moveToDate = sourceShift ? targetDate : sourceDate;
                                    const timeOnly = existingShift.start_time.split('T')[1];
                                    const endTimeOnly = existingShift.end_time.split('T')[1];

                                    const { error } = await supabase.from('shifts').update({
                                        start_time: `${moveToDate}T${timeOnly}`,
                                        end_time: `${moveToDate}T${endTimeOnly}`
                                    }).eq('id', existingShift.id);
                                    if (error) throw error;
                                }
                            }
                        }
                    }
                } else {
                    // --- CASE 3: PEER SWAP (proper 2-way swap) ---
                    const shiftDate = request.shifts.start_time.split('T')[0];

                    // Find the receiver's shift on the same date
                    const { data: receiverShift } = await supabase
                        .from('shifts')
                        .select('*')
                        .eq('employee_id', request.receiver_id)
                        .gte('start_time', `${shiftDate}T00:00:00`)
                        .lte('start_time', `${shiftDate}T23:59:59`)
                        .maybeSingle();

                    if (receiverShift) {
                        // 2-way swap: swap employee_ids
                        const { error: err1 } = await supabase.from('shifts')
                            .update({ employee_id: request.receiver_id })
                            .eq('id', request.shift_id);
                        const { error: err2 } = await supabase.from('shifts')
                            .update({ employee_id: request.requestor_id })
                            .eq('id', receiverShift.id);
                        if (err1 || err2) throw new Error("Peer swap failed");
                    } else {
                        // Receiver has no shift — just reassign the requester's shift
                        const { error } = await supabase.from('shifts')
                            .update({ employee_id: request.receiver_id })
                            .eq('id', request.shift_id);
                        if (error) throw error;
                    }
                }
            }

            // Update request status
            const { error: statusErr } = await supabase.from('swap_requests').update({ status: action }).eq('id', request.id);
            if (statusErr) throw statusErr;
            fetchRequests();
        } catch (err: any) {
            console.error("Approval Error:", err);
            alert(`Action Failed: ${err.message}`);
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

    const getRequestType = (req: any) => {
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
        if (s === 'cancelled') return 'bg-slate-50 border-slate-200 text-slate-400';
        return 'bg-amber-50 border-amber-100 text-amber-600';
    };

    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8 font-sans pb-32">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-medium tracking-tight text-slate-900">Request Hub</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Live Sync Enabled
                    </p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
                    <button onClick={() => setActiveTab('pending')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>
                        Pending ({requests.filter(r => r.status === 'pending').length})
                    </button>
                    <button onClick={() => setActiveTab('history')} className={`px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white shadow-md text-slate-900' : 'text-slate-400'}`}>
                        History
                    </button>
                </div>
            </header>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input type="text" placeholder="Search personnel..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 text-[10px] font-bold uppercase outline-none focus:ring-2 focus:ring-slate-900/5" />
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="py-20 flex flex-col items-center gap-4 opacity-30">
                    <Loader2 className="animate-spin" size={24} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Loading requests...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[2rem]">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                        {activeTab === 'pending' ? 'No pending requests' : 'No history found'}
                    </p>
                </div>
            ) : (
                /* Request Cards */
                <div className="grid gap-4">
                    <AnimatePresence mode="popLayout">
                        {filtered.map((req) => {
                            const reqType = getRequestType(req);
                            return (
                                <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={req.id}
                                    className={`bg-white border rounded-[2.5rem] p-8 transition-all ${req.status !== 'pending' ? 'opacity-60' : 'border-slate-100 shadow-sm hover:shadow-md'}`}>

                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-start gap-5">
                                            {/* Icon */}
                                            <div className={`p-4 rounded-2xl shrink-0 ${reqType.color}`}>
                                                {reqType.icon}
                                            </div>

                                            {/* Details */}
                                            <div className="space-y-2 min-w-0 flex-1">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <span className="text-lg font-bold text-slate-900">{req.requestor?.full_name}</span>
                                                    <span className="text-[8px] font-black uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 shrink-0">
                                                        {reqType.type}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 italic font-medium leading-relaxed">"{req.message}"</p>

                                                {/* Shift Date Info */}
                                                {req.shifts && (
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Clock size={12} className="text-slate-300" />
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                            Shift: {new Date(req.shifts.start_time).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                            {req.shifts.shift_label && <span className="ml-2 text-slate-500">({req.shifts.shift_label})</span>}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Peer swap receiver info */}
                                                {req.requestor_id !== req.receiver_id && req.receiver?.full_name && (
                                                    <div className="flex items-center gap-2">
                                                        <ArrowRight size={12} className="text-slate-300" />
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase">To: {req.receiver.full_name}</span>
                                                    </div>
                                                )}

                                                {/* Timestamp */}
                                                <p className="text-[9px] text-slate-300 font-bold">
                                                    {new Date(req.created_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {req.status === 'pending' ? (
                                                <>
                                                    <button onClick={() => handleAction(req, 'declined')}
                                                        className="p-4 rounded-2xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-all active:scale-95">
                                                        <X size={20} />
                                                    </button>
                                                    <button onClick={() => handleAction(req, 'approved')}
                                                        disabled={processingId === req.id}
                                                        className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-slate-900 text-white hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 active:scale-95 disabled:opacity-50">
                                                        {processingId === req.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                        <span className="text-[10px] font-black uppercase tracking-widest">Approve</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <div className={`px-6 py-3 rounded-full text-[9px] font-black uppercase border ${getStatusStyle(req.status)}`}>
                                                    {req.status}
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