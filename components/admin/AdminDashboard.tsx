


'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import BulkScheduler from './BulkScheduler';
import PresetManager from './PresetManager';
import {
    RotateCcw, Check, X, Clock, User, AlertCircle, Calendar, Filter
} from 'lucide-react';

export default function AdminDashboard({ employees, liveAttendance, adminId }: any) {
    const supabase = createClient();

    // --- Navigation State ---
    const [activeTab, setActiveTab] = useState<'live' | 'schedule' | 'leaves' | 'alerts'>('live');
    const [showHistory, setShowHistory] = useState(false);

    // --- Data States ---
    const [overrides, setOverrides] = useState<any[]>([]);
    const [leaves, setLeaves] = useState<any[]>([]);
    const [leaveHistory, setLeaveHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // --- History Filters ---
    const [histFilterEmployee, setHistFilterEmployee] = useState('');
    const [histFilterStart, setHistFilterStart] = useState('');
    const [histFilterEnd, setHistFilterEnd] = useState('');

    // --- Data Fetching ---
    useEffect(() => {
        if (activeTab === 'leaves') {
            if (showHistory) fetchLeaveHistory();
            else fetchLeaves();
        } else if (activeTab === 'alerts') {
            fetchOverrides();
        }

        // Realtime sync for all admin data
        const channel = supabase.channel('admin_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => {
                fetchLeaves();
                if (showHistory) fetchLeaveHistory();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'swap_requests' }, fetchOverrides)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [activeTab, showHistory, histFilterEmployee, histFilterStart, histFilterEnd]);

    const fetchLeaves = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('leave_requests')
            .select('*, profiles:employee_id(full_name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: true });
        setLeaves(data || []);
        setLoading(false);
    };

    const fetchLeaveHistory = async () => {
        setLoading(true);
        // neq('status', 'pending') ensures we ONLY see Approved or Rejected
        let query = supabase
            .from('leave_requests')
            .select('*, profiles:employee_id(full_name)')
            .neq('status', 'pending');

        if (histFilterEmployee) query = query.eq('employee_id', histFilterEmployee);
        if (histFilterStart) query = query.gte('start_date', histFilterStart);
        if (histFilterEnd) query = query.lte('end_date', histFilterEnd);

        const { data } = await query.order('start_date', { ascending: false });
        setLeaveHistory(data || []);
        setLoading(false);
    };

    const fetchOverrides = async () => {
        const { data } = await supabase
            .from('swap_requests')
            .select('*, profiles:requestor_id(full_name)')
            .ilike('message', 'OVERRIDE REQUEST%')
            .eq('status', 'pending');
        setOverrides(data || []);
    };

    // --- Handlers ---
    const handleLeaveAction = async (leaveId: string, newStatus: 'approved' | 'rejected') => {
        const { error } = await supabase
            .from('leave_requests')
            .update({ status: newStatus, approved_by: adminId })
            .eq('id', leaveId);

        if (!error) {
            // Re-fetch both to ensure UI reflects the DB change immediately
            await fetchLeaves();
            if (showHistory) await fetchLeaveHistory();
        }
    };

    const handleApproveOverride = async (request: any) => {
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('attendance').delete().eq('employee_id', request.requestor_id).gte('check_in', `${today}T00:00:00Z`);
        await supabase.from('swap_requests').update({ status: 'approved' }).eq('id', request.id);
        fetchOverrides();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start p-4 lg:p-8">

            {/* 🖥️ SIDEBAR NAVIGATION */}
            <aside className="lg:col-span-3 space-y-4 lg:sticky lg:top-4">
                <nav className="bg-white border border-slate-200 p-2 rounded-2xl shadow-sm flex lg:flex-col gap-1">
                    {[
                        { id: 'live', label: 'Live Status', icon: '⚡' },
                        { id: 'schedule', label: 'Shift Planner', icon: '📅' },
                        { id: 'leaves', label: 'Leave Requests', icon: '🏖️', count: leaves.length },
                        { id: 'alerts', label: 'Overrides', icon: '🚨', count: overrides.length }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id as any); setShowHistory(false); }}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span>{tab.icon}</span>
                                <span>{tab.label}</span>
                            </div>
                            {tab.count ? (
                                <span className="bg-rose-500 text-white text-[9px] px-2 py-0.5 rounded-full animate-pulse">
                                    {tab.count}
                                </span>
                            ) : null}
                        </button>
                    ))}
                </nav>
                {activeTab === 'schedule' && <PresetManager />}
            </aside>

            {/* 📈 MAIN PANEL */}
            <section className="lg:col-span-9 w-full">
                <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm min-h-[600px] overflow-hidden">

                    {/* LEAVE MANAGEMENT TAB */}
                    {activeTab === 'leaves' && (
                        <div className="p-8 space-y-6 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex gap-8">
                                    <button
                                        onClick={() => setShowHistory(false)}
                                        className={`text-[11px] font-black uppercase tracking-widest pb-3 transition-all ${!showHistory ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-300 hover:text-slate-400'}`}
                                    >
                                        Pending ({leaves.length})
                                    </button>
                                    <button
                                        onClick={() => setShowHistory(true)}
                                        className={`text-[11px] font-black uppercase tracking-widest pb-3 transition-all ${showHistory ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-300 hover:text-slate-400'}`}
                                    >
                                        History Archive
                                    </button>
                                </div>
                            </div>

                            {!showHistory ? (
                                <div className="space-y-4">
                                    {loading ? (
                                        <div className="py-20 flex justify-center opacity-20"><Clock className="animate-spin" /></div>
                                    ) : leaves.length === 0 ? (
                                        <div className="py-24 text-center border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 text-[10px] font-black uppercase">No pending requests</div>
                                    ) : (
                                        leaves.map(l => (
                                            <div key={l.id} className="p-6 border border-slate-100 rounded-[1.5rem] flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-50/30 hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-sm uppercase">{l.profiles?.full_name?.charAt(0)}</div>
                                                    <div>
                                                        <p className="text-sm font-black text-slate-900 uppercase">{l.profiles?.full_name}</p>
                                                        <p className="text-[11px] text-slate-500 font-bold">{new Date(l.start_date).toLocaleDateString()} — {new Date(l.end_date).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm italic text-slate-600 text-[11px]">
                                                    "{l.reason || 'No specific reason provided.'}"
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleLeaveAction(l.id, 'approved')} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 transition-all flex items-center gap-2"><Check size={14} /> Approve</button>
                                                    <button onClick={() => handleLeaveAction(l.id, 'rejected')} className="bg-white border border-slate-200 text-rose-500 px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-rose-50 transition-all flex items-center gap-2"><X size={14} /> Reject</button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* History Filter Bar */}
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-900 p-5 rounded-[1.5rem] shadow-xl">
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Employee</label>
                                            <select value={histFilterEmployee} onChange={(e) => setHistFilterEmployee(e.target.value)} className="w-full bg-slate-800 border-none rounded-xl px-3 py-2 text-[11px] font-bold text-white outline-none">
                                                <option value="">All Staff</option>
                                                {employees?.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Start</label>
                                            <input type="date" value={histFilterStart} onChange={(e) => setHistFilterStart(e.target.value)} className="w-full bg-slate-800 border-none rounded-xl px-3 py-2 text-[11px] font-bold text-white outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">End</label>
                                            <input type="date" value={histFilterEnd} onChange={(e) => setHistFilterEnd(e.target.value)} className="w-full bg-slate-800 border-none rounded-xl px-3 py-2 text-[11px] font-bold text-white outline-none" />
                                        </div>
                                        <button onClick={() => { setHistFilterEmployee(''); setHistFilterStart(''); setHistFilterEnd(''); }} className="bg-slate-800 text-slate-400 p-2.5 rounded-xl hover:text-white transition-colors flex items-center justify-center self-end">
                                            <RotateCcw size={18} />
                                        </button>
                                    </div>

                                    {/* History List */}
                                    {loading ? (
                                        <div className="py-20 flex justify-center opacity-20"><Clock className="animate-spin" /></div>
                                    ) : leaveHistory.length === 0 ? (
                                        <div className="py-24 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-slate-50 rounded-[2rem]">No historical records</div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3">
                                            {leaveHistory.map((item) => (
                                                <div key={item.id} className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between bg-white hover:border-slate-300 transition-all shadow-sm">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                            {item.status === 'approved' ? <Check size={18} /> : <X size={18} />}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-black text-slate-900 uppercase">{item.profiles?.full_name}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold">{new Date(item.start_date).toLocaleDateString()} - {new Date(item.end_date).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${item.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
                                                            }`}>
                                                            {item.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* LIVE STATUS TAB */}
                    {activeTab === 'live' && (
                        <div className="p-8 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">Live Store Presence</h3>
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {liveAttendance.map((record: any) => (
                                    <div key={record.id} className="p-4 rounded-2xl border border-slate-100 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                                        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">{record.profiles?.full_name?.charAt(0)}</div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-900">{record.profiles?.full_name}</p>
                                            <p className="text-[10px] text-slate-400 uppercase">In: {new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* OVERRIDES TAB */}
                    {activeTab === 'alerts' && (
                        <div className="p-8 space-y-6">
                            <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">System Overrides</h3>
                            <div className="space-y-4">
                                {overrides.map(req => (
                                    <div key={req.id} className="bg-rose-50/50 p-6 rounded-[1.5rem] border border-rose-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-black text-slate-900 uppercase">{req.profiles?.full_name}</p>
                                            <p className="text-xs text-rose-500 font-bold italic mt-1 flex items-center gap-2"><AlertCircle size={14} /> {req.message}</p>
                                        </div>
                                        <button onClick={() => handleApproveOverride(req)} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest">Approve Re-Entry</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* SHIFT PLANNER TAB */}
                    {activeTab === 'schedule' && (
                        <div className="animate-in fade-in duration-500">
                            <BulkScheduler employees={employees} />
                        </div>
                    )}

                </div>
            </section>
        </div>
    );
}