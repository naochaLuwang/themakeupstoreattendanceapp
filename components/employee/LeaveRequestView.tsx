'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Send, Loader2, X, Plus, Trash2 } from 'lucide-react';

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
        const { error } = await supabase.from('leave_requests').insert([{
            employee_id: userId,
            start_date: startDate,
            end_date: endDate,
            reason: reason,
            status: 'pending'
        }]);

        if (!error) {
            setShowForm(false);
            setStartDate(''); setEndDate(''); setReason('');
            fetchLeaveData();
        } else {
            alert(error.message);
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
                <h3 className="text-[10px] font-black text-slate-400 uppercase px-2 tracking-widest flex items-center gap-2"><Clock size={12} /> Recent Activity</h3>
                {history.map(req => (
                    <div key={req.id} className="bg-white border border-slate-100 p-5 rounded-[1.5rem] flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-900">{req.start_date} - {req.end_date}</p>
                            <span className={`text-[8px] font-black uppercase tracking-widest ${req.status === 'approved' ? 'text-emerald-500' : 'text-amber-500'}`}>{req.status}</span>
                        </div>
                        {req.status === 'pending' && (
                            <button onClick={async () => { await supabase.from('leave_requests').delete().eq('id', req.id); fetchLeaveData(); }} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                ))}
                {history.length === 0 && <div className="text-center py-10 bg-slate-50 rounded-[2rem] text-[10px] font-black text-slate-300 uppercase">No History Found</div>}
            </div>

            <AnimatePresence>
                {showForm && (
                    <motion.form initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} onSubmit={handleSubmit} className="fixed bottom-32 left-6 right-6 bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl z-[100] space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <input type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-slate-800 border-none rounded-xl p-4 text-white text-xs font-bold" />
                            <input type="date" required value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-slate-800 border-none rounded-xl p-4 text-white text-xs font-bold" />
                        </div>
                        <textarea placeholder="Reason..." value={reason} onChange={e => setReason(e.target.value)} className="w-full bg-slate-800 border-none rounded-xl p-4 text-white text-xs font-bold h-24 resize-none" />
                        <button disabled={loading} className="w-full bg-white text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Submit Request
                        </button>
                    </motion.form>
                )}
            </AnimatePresence>
        </div>
    );
}