'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, Send, Loader2, X, Plus, Trash2, ArrowRight } from 'lucide-react';
import WorkspaceDialog from '@/components/WorkspaceDialog';
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
        <div className="employee-screen employee-leave-screen space-y-6">
            <header className="employee-page-heading flex items-end justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 tracking-normal mb-1">Time off</p>
                    <h1 className="text-3xl font-medium text-slate-900">Leave requests</h1>
                </div>
                <button aria-label="New leave request" aria-haspopup="dialog" aria-expanded={showForm} onClick={() => setShowForm(!showForm)} className={`p-3 rounded-xl transition-colors ${showForm ? 'bg-slate-100 text-slate-500' : 'bg-slate-900 text-white '}`}>
                    {showForm ? <X size={20} /> : <Plus size={20} />}
                </button>
            </header>

            <div className="employee-leave-totals grid grid-cols-2 gap-4">
                <div className="bg-white border border-slate-100 p-6 rounded-xl shadow-sm">
                    <p className="text-xs font-medium text-slate-500 tracking-normal mb-1">Approved requests</p>
                    <p className="text-3xl font-medium text-slate-900">{stats.approved}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-xl shadow-sm">
                    <p className="text-xs font-medium text-slate-500 tracking-normal mb-1">Pending</p>
                    <p className="text-3xl font-medium text-slate-900">{stats.pending}</p>
                </div>
            </div>

            <div className="employee-leave-history space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-sm font-medium text-slate-500 tracking-normal flex items-center gap-2"><Clock size={12} /> Recent requests</h3>
                </div>
                {history.map(req => (
                    <div key={req.id} className="employee-leave-record bg-white border border-slate-100 p-5 rounded-xl flex items-start justify-between">
                        <div>
                            <p className="text-xs font-medium text-slate-900 flex items-center gap-2">{req.start_date} <ArrowRight size={10} className="text-slate-500" /> {req.end_date}</p>
                            <p className="text-sm text-slate-500 font-medium mt-1.5 pr-4 leading-relaxed">"{req.reason}"</p>
                            <div className="mt-3">
                                <span className={`px-2.5 py-1 rounded-[8px] text-xs font-medium  tracking-normal ${req.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{req.status}</span>
                            </div>
                        </div>
                        {req.status === 'pending' && (
                            <button aria-label="Cancel pending leave request" onClick={async () => { await supabase.from('leave_requests').delete().eq('id', req.id); fetchLeaveData(); }} className="p-3 bg-slate-50 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0">
                                <Trash2 size={16} />
                            </button>
                        )}
                    </div>
                ))}
                {history.length === 0 && <div className="text-center py-10 bg-slate-50 rounded-xl text-sm font-medium text-slate-500">No leave requests yet</div>}
            </div>

            <WorkspaceDialog open={showForm} onClose={() => setShowForm(false)} labelledBy="leave-request-title">
                        <form onSubmit={handleSubmit} className="relative space-y-6">
                            <button type="button" onClick={() => setShowForm(false)} aria-label="Close leave request" className="employee-icon-button absolute top-0 right-0">
                                <X size={16} />
                            </button>
                            <div>
                                <h3 id="leave-request-title" className="text-xl font-medium text-slate-900 pr-12">Request time off</h3>
                                <p className="text-sm font-medium text-slate-500 tracking-normal mt-1">Submit your dates and reason</p>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <label htmlFor="leave-start" className="text-sm text-slate-500">Start date</label>
                                        <input id="leave-start" type="date" required value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-slate-900 text-xs font-medium outline-none focus:border-indigo-500 focus:bg-indigo-50 transition-colors cursor-pointer" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label htmlFor="leave-end" className="text-sm text-slate-500">End date</label>
                                        <input id="leave-end" type="date" required min={startDate || undefined} value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-slate-900 text-xs font-medium outline-none focus:border-indigo-500 focus:bg-indigo-50 transition-colors cursor-pointer" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="leave-reason" className="text-sm text-slate-500">Reason</label>
                                    <textarea id="leave-reason" required placeholder="Reason for your request" value={reason} onChange={e => setReason(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-slate-900 text-xs font-medium h-28 resize-none outline-none focus:border-indigo-500 focus:bg-indigo-50 transition-colors leading-relaxed" />
                                </div>
                            </div>
                            <button disabled={loading} className="w-full bg-slate-900 text-white py-5 rounded-xl text-sm font-medium tracking-normal flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                                {loading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />} Submit request
                            </button>
                        </form>
            </WorkspaceDialog>
        </div>
    );
}
