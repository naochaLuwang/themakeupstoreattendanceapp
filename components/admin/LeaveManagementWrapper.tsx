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

    const handleAction = async (id: string, status: 'approved' | 'declined') => {
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
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-8">
            <div className="flex gap-8 border-b border-slate-100 mb-8">
                <button
                    onClick={() => setShowHistory(false)}
                    className={`pb-4 text-sm font-medium  tracking-normal transition-colors ${!showHistory ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-500'}`}
                >
                    Pending Queue ({leaves.length})
                </button>
                <button
                    onClick={() => setShowHistory(true)}
                    className={`pb-4 text-sm font-medium  tracking-normal transition-colors ${showHistory ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-500'}`}
                >
                    Archive
                </button>
            </div>

            {showHistory ? (
                <div className="space-y-6">
                    <div className="flex items-center gap-3 bg-slate-900 p-4 rounded-xl">
                        <div className="relative flex-1">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                            <select
                                value={selectedEmployee}
                                onChange={(e) => setSelectedEmployee(e.target.value)}
                                className="w-full bg-slate-800 border-none rounded-xl pl-12 pr-4 py-3 text-sm font-medium text-white outline-none appearance-none"
                            >
                                <option value="">All Personnel</option>
                                {employees?.map((emp: any) => (
                                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={() => setSelectedEmployee('')} className="bg-slate-800 text-slate-500 p-3.5 rounded-xl hover:text-white transition-colors">
                            <RotateCcw size={18} />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {loading ? (
                            <div className="py-20 text-center text-sm font-medium text-slate-500">Updating...</div>
                        ) : leaveHistory.map(item => (
                            <div key={item.id} className="p-5 border border-slate-100 rounded-xl flex items-center justify-between bg-slate-50/30">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                        {item.status === 'approved' ? <Check size={18} /> : <X size={18} />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-slate-900 tracking-normal">{item.profiles?.full_name || 'Staff'}</p>
                                        <p className="text-sm text-slate-500 font-medium">{item.start_date} — {item.end_date}</p>
                                    </div>
                                </div>
                                <span className={`text-xs font-medium  px-3 py-1 rounded-full border ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{item.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {leaves.length > 0 ? leaves.map(l => (
                        <div key={l.id} className="p-6 border border-slate-100 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 bg-white shadow-sm border-l-4 border-l-blue-500">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-medium">
                                    {l.profiles?.full_name?.[0] || '?'}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-900">{l.profiles?.full_name}</p>
                                    <p className="text-sm text-slate-500 font-medium">{l.start_date} — {l.end_date}</p>
                                </div>
                            </div>
                            <div className="flex-1 text-slate-500 text-sm px-6 border-l border-slate-100 line-clamp-2">
                                "{l.reason || 'No reason'}"
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button onClick={() => handleAction(l.id, 'approved')} className="flex-1 bg-slate-900 text-white px-6 py-4 rounded-xl text-sm font-medium tracking-normal flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"><Check size={14} /> Approve</button>
                                <button onClick={() => handleAction(l.id, 'declined')} className="flex-1 bg-white border border-slate-200 text-rose-500 px-6 py-4 rounded-xl text-sm font-medium tracking-normal flex items-center justify-center gap-2 hover:bg-rose-50 transition-colors"><X size={14} /> Reject</button>
                            </div>
                        </div>
                    )) : (
                        <div className="py-24 text-center border border-dashed border-slate-100 rounded-xl">
                            <p className="text-sm font-medium text-slate-500 tracking-normal">No pending requests</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
