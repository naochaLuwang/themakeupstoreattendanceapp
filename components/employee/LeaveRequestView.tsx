'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Send, Loader2, X, Plus, Trash2, ArrowRight } from 'lucide-react';
import { createLeaveRequestAction } from '@/app/actions/requests';

export default function LeaveRequestView({ userId }: { userId: string }) {
    const supabase = createClient();
    const [showForm, setShowForm] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [stats, setStats] = useState({ approved: 0, pending: 0 });
    const [loading, setLoading] = useState(false);

    // Form State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reason, setReason] = useState('');

    useEffect(() => {
        if (userId) fetchLeaveData();
    }, [userId]);

    const fetchLeaveData = async () => {
        const { data, error } = await supabase
            .from('leave_requests')
            .select('*')
            .eq('employee_id', userId)
            .order('start_date', { ascending: false });

        if (error) {
            console.error("Fetch Error:", error.message);
            return;
        }

        if (data) {
            setHistory(data);
            const approvedDays = data.filter(r => r.status === 'approved').length; // Simplified for this example
            const pendingCount = data.filter(r => r.status === 'pending').length;
            setStats({ approved: approvedDays, pending: pendingCount });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        
        const result = await createLeaveRequestAction(userId, startDate, endDate, reason);

        if (result.success) {
            setShowForm(false);
            setStartDate(''); setEndDate(''); setReason('');
            fetchLeaveData();
        } else {
            alert(result.error || "Submission failed.");
        }
        setLoading(false);
    };

    return (
        <div className="px-6 pt-6 pb-32 max-w-md mx-auto space-y-8">
            <header className="flex items-end justify-between">
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Timekeeping</p>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Time Off</h2>
                </div>
                <button onClick={() => setShowForm(!showForm)} className={`p-3 rounded-2xl transition-all ${showForm ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white shadow-xl'}`}>
                    {showForm ? <X size={20} /> : <Plus size={20} />}
                </button>
            </header>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Requests</p>
                    <p className="text-3xl font-black text-slate-900">{stats.approved}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending</p>
                    <p className="text-3xl font-black text-slate-900">{stats.pending}</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={12} /> Recent Activity</h3>
                </div>
                {history.map(req => (
                    <div key={req.id} className="bg-white border border-slate-100 p-5 rounded-[1.5rem] flex items-start justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-900 flex items-center gap-2">{req.start_date} <ArrowRight size={10} className="text-slate-300" /> {req.end_date}</p>
                            <p className="text-[10px] text-slate-500 font-medium mt-1.5 pr-4 italic leading-relaxed">"{req.reason}"</p>
                            <div className="mt-3">
                                <span className={`px-2.5 py-1 rounded-[8px] text-[8px] font-black uppercase tracking-widest ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{req.status}</span>
                            </div>
                        </div>
                        {req.status === 'pending' && (
                            <button onClick={async () => { await supabase.from('leave_requests').delete().eq('id', req.id); fetchLeaveData(); }} className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0">
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                ))}
                {history.length === 0 && <div className="text-center py-10 bg-slate-50 rounded-[2rem] text-[10px] font-black text-slate-300 uppercase">No History Found</div>}
            </div>

            <AnimatePresence>
                {showForm && (
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.form initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }} onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-8 rounded-[2.5rem] shadow-2xl relative space-y-6">
                            <button type="button" onClick={() => setShowForm(false)} className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 hover:text-slate-600 transition-colors">
                                <X size={16} />
                            </button>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Time Off Request</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Submit your dates and reason</p>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Start Date</label>
                                        <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-indigo-50 transition-all cursor-pointer" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">End Date</label>
                                        <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 text-xs font-bold outline-none focus:border-indigo-500 focus:bg-indigo-50 transition-all cursor-pointer" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2">Reason</label>
                                    <textarea required placeholder="Brief reason for your request..." value={reason} onChange={e => setReason(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-900 text-xs font-medium h-28 resize-none outline-none focus:border-indigo-500 focus:bg-indigo-50 transition-all leading-relaxed" />
                                </div>
                            </div>
                            <button disabled={loading} className="w-full bg-slate-900 text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-95 transition-all shadow-xl shadow-slate-200">
                                {loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Submit Request
                            </button>
                        </motion.form>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}