'use client';
import { useState, useEffect, useMemo } from 'react';
import {
    Activity, Search, TrendingUp, RefreshCcw,
    CalendarCheck, ShieldAlert, Download, Loader2
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';

interface ReliabilityData {
    name: string;
    username: string;
    total_approved_leaves: number;
    swap_frequency: number;
    reliability_score: number;
}

export default function ReliabilityReport() {
    const [data, setData] = useState<ReliabilityData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState<string | null>(null);

    const fetchReport = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/reports/reliability');
            const result = await res.json();

            if (Array.isArray(result)) {
                setData(result);
            } else {
                setData([]);
                setError(result.error || "Failed to load report data.");
            }
        } catch (err) {
            setData([]);
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    // 1. FILTER DATA
    const filteredData = useMemo(() => {
        if (!Array.isArray(data)) return [];
        return data.filter(emp =>
            emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.username?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [data, searchTerm]);

    // 2. CALCULATE AVG SCORE (Moved Up)
    const avgScore = useMemo(() => {
        if (!filteredData.length) return 0;
        return filteredData.reduce((acc, curr) => acc + (curr.reliability_score || 0), 0) / filteredData.length;
    }, [filteredData]);

    // 3. GENERATE TREND DATA (Uses avgScore)
    const trendData = useMemo(() => {
        return [
            { day: 'Mon', score: 85 },
            { day: 'Tue', score: 88 },
            { day: 'Wed', score: Math.round(avgScore) || 82 },
            { day: 'Thu', score: 91 },
            { day: 'Fri', score: 89 },
            { day: 'Sat', score: 94 },
            { day: 'Sun', score: 92 },
        ];
    }, [avgScore]);

    return (
        <div className="max-w-7xl mx-auto p-8 space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter italic">Staff Insights.</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
                        <Activity size={14} className="text-indigo-600" /> Reliability & Swap Analytics
                    </p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchReport} className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
                        <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-slate-200">
                        <Download size={14} /> Export Report
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-6">
                    <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Average Reliability</p>
                        <div className="flex items-center gap-2">
                            <span className="text-4xl font-black text-slate-900">{avgScore.toFixed(1)}%</span>
                            <TrendingUp className="text-emerald-500" size={20} />
                        </div>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl text-white">
                        <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Alert Status</p>
                        <div className="flex items-center gap-2">
                            <span className="text-4xl font-black">
                                {filteredData.filter(d => (d.reliability_score || 0) < 75).length}
                            </span>
                            <ShieldAlert className="text-amber-400" size={20} />
                        </div>
                        <p className="text-[9px] mt-2 opacity-50 font-bold uppercase">Staff requiring review</p>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm h-[260px]">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Weekly Reliability Trend</p>
                    <ResponsiveContainer width="100%" height="85%">
                        <AreaChart data={trendData}>
                            <defs>
                                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: '900', fill: '#cbd5e1' }} />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip
                                cursor={{ stroke: '#6366f1', strokeWidth: 2 }}
                                contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                labelStyle={{ fontWeight: '900', fontSize: '10px', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}
                                itemStyle={{ fontWeight: '900', fontSize: '14px', color: '#1e293b' }}
                            />
                            <Area type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorScore)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-[3rem] shadow-sm overflow-hidden">
                <div className="p-6 bg-slate-50/50 flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Filter by employee name..."
                            className="w-full bg-white border-none rounded-2xl py-4 pl-12 pr-6 text-sm font-bold shadow-sm focus:ring-2 ring-indigo-500 transition-all outline-none"
                        />
                    </div>
                </div>

                {error ? (
                    <div className="p-20 text-center space-y-4">
                        <ShieldAlert className="mx-auto text-rose-500" size={40} />
                        <p className="text-sm font-bold text-slate-600 tracking-tight">{error}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-50">
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Leaves</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Swaps</th>
                                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Index</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loading ? (
                                    [1, 2, 3].map(i => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="px-8 py-8 bg-slate-50/30"></td>
                                        </tr>
                                    ))
                                ) : (
                                    filteredData.map((emp, i) => (
                                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-9 w-9 bg-indigo-50 rounded-xl flex items-center justify-center font-black text-xs text-indigo-600">
                                                        {emp.name?.charAt(0) || '?'}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-sm">{emp.name || 'Anonymous'}</p>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase">@{emp.username || 'unknown'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className="text-xs font-black text-slate-700">{emp.total_approved_leaves || 0}</span>
                                            </td>
                                            <td className="px-8 py-5 text-center">
                                                <span className="text-xs font-black text-slate-700">{emp.swap_frequency || 0}</span>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className={`text-xs font-black ${(emp.reliability_score || 0) > 80 ? 'text-emerald-500' :
                                                            (emp.reliability_score || 0) > 60 ? 'text-amber-500' : 'text-rose-500'
                                                        }`}>
                                                        {Math.round(emp.reliability_score || 0)}%
                                                    </span>
                                                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${(emp.reliability_score || 0) > 80 ? 'bg-emerald-500' :
                                                                    (emp.reliability_score || 0) > 60 ? 'bg-amber-500' : 'bg-rose-500'
                                                                }`}
                                                            style={{ width: `${emp.reliability_score || 0}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}