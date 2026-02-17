'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Check, X, Clock, RotateCcw, User } from 'lucide-react';

export default function LeaveManagementWrapper({ adminId, employees }: any) {
    const supabase = createClient();
    const [showHistory, setShowHistory] = useState(false);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState('');

    useEffect(() => {
        if (showHistory) fetchLeaveHistory();
        else fetchLeaves();
    }, [showHistory, selectedEmployee]);

    const fetchLeaves = async () => {
        setLoading(true);
        // REMOVED created_at and fixed join syntax
        const { data, error } = await supabase
            .from('leave_requests')
            .select(`
                *,
                profiles:employee_id (
                    full_name
                )
            `)
            .eq('status', 'pending')
            .order('start_date', { ascending: true }); // Ordering by start_date instead

        if (error) {
            console.error("Fetch Error:", error.message);
        }
        setLeaves(data || []);
        setLoading(false);
    };

    const fetchLeaveHistory = async () => {
        setLoading(true);
        let query = supabase
            .from('leave_requests')
            .select(`
                *,
                profiles:employee_id (
                    full_name
                )
            `)
            .neq('status', 'pending');

        if (selectedEmployee) {
            query = query.eq('employee_id', selectedEmployee);
        }

        // Ordering history by the date they are actually taking off
        const { data, error } = await query.order('start_date', { ascending: false });

        if (error) console.error("History Error:", error.message);
        setLeaveHistory(data || []);
        setLoading(false);
    };

    const handleAction = async (id: string, status: 'approved' | 'rejected') => {
        const { error } = await supabase
            .from('leave_requests')
            .update({
                status,
                approved_by: adminId
            })
            .eq('id', id);

        if (!error) {
            showHistory ? fetchLeaveHistory() : fetchLeaves();
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden p-8">
            <div className="flex gap-8 border-b border-slate-100 mb-8">
                <button
                    onClick={() => setShowHistory(false)}
                    className={`pb-4 text-[11px] font-black uppercase tracking-widest transition-all ${!showHistory ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-300'}`}
                >
                    Pending Queue ({leaves.length})
                </button>
                <button
                    onClick={() => setShowHistory(true)}
                    className={`pb-4 text-[11px] font-black uppercase tracking-widest transition-all ${showHistory ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-300'}`}
                >
                    Archive
                </button>
            </div>

            {showHistory ? (
                <div className="space-y-6">
                    <div className="flex items-center gap-3 bg-slate-900 p-4 rounded-3xl shadow-inner">
                        <div className="relative flex-1">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <select
                                value={selectedEmployee}
                                onChange={(e) => setSelectedEmployee(e.target.value)}
                                className="w-full bg-slate-800 border-none rounded-2xl pl-12 pr-4 py-3 text-[11px] font-black text-white uppercase outline-none appearance-none"
                            >
                                <option value="">All Personnel</option>
                                {employees?.map((emp: any) => (
                                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={() => setSelectedEmployee('')} className="bg-slate-800 text-slate-400 p-3.5 rounded-2xl hover:text-white transition-all">
                            <RotateCcw size={18} />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="py-20 text-center animate-pulse text-[10px] font-black text-slate-300 uppercase">Updating...</div>
                        ) : leaveHistory.map(item => (
                            <div key={item.id} className="p-5 border border-slate-100 rounded-[2rem] flex items-center justify-between bg-slate-50/30">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {item.status === 'approved' ? <Check size={18} /> : <X size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.profiles?.full_name || 'Staff'}</p>
                                        <p className="text-[10px] text-slate-400 font-bold">{item.start_date} — {item.end_date}</p>
                                    </div>
                                </div>
                                <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full border ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{item.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {leaves.length > 0 ? leaves.map(l => (
                        <div key={l.id} className="p-6 border border-slate-100 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 bg-white shadow-sm border-l-4 border-l-blue-500">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black uppercase">
                                    {l.profiles?.full_name?.[0] || '?'}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-900 uppercase">{l.profiles?.full_name}</p>
                                    <p className="text-[11px] text-slate-500 font-bold">{l.start_date} — {l.end_date}</p>
                                </div>
                            </div>
                            <div className="flex-1 italic text-slate-400 text-[11px] px-6 border-l border-slate-100 line-clamp-2">
                                "{l.reason || 'No reason'}"
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button onClick={() => handleAction(l.id, 'approved')} className="flex-1 bg-slate-900 text-white px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all"><Check size={14} /> Approve</button>
                                <button onClick={() => handleAction(l.id, 'rejected')} className="flex-1 bg-white border border-slate-200 text-rose-500 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-50 transition-all"><X size={14} /> Reject</button>
                            </div>
                        </div>
                    )) : (
                        <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No pending requests</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}