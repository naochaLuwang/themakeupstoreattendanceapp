'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion } from 'framer-motion';
import { Calendar, Loader2, BarChart3, PieChart, TrendingUp, Grid3x3, Clock } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
    ResponsiveContainer, PieChart as RePieChart, Pie, Cell,
    LineChart, Line
} from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PUNCTUALLY_GRACE_MINUTES = 5;

const COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
    '#06b6d4', '#f97316', '#22d3ee', '#a855f7', '#14b8a6', '#e11d48',
];

export default function AttendanceGraphs() {
    const supabase = createClient();
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [loading, setLoading] = useState(false);

    const [employees, setEmployees] = useState<any[]>([]);
    const [monthlyTotals, setMonthlyTotals] = useState<any[]>([]);
    const [dailyTrend, setDailyTrend] = useState<any[]>([]);
    const [punctuality, setPunctuality] = useState<any[]>([]);
    const [donut, setDonut] = useState<any[]>([]);
    const [weeklyTrend, setWeeklyTrend] = useState<any[]>([]);
    const [heatmap, setHeatmap] = useState<any[]>([]);

    const fetchAllData = useCallback(async () => {
        setLoading(true);

        const [yearStr, monthStr] = selectedMonth.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        const daysInMonth = new Date(year, month, 0).getDate();
        const monthStart = `${selectedMonth}-01T00:00:00Z`;
        const monthEnd = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}T23:59:59Z`;

        const [profilesRes, shiftsRes, attRes] = await Promise.all([
            supabase.from('profiles').select('id, full_name').eq('role', 'employee').order('full_name'),
            supabase.from('shifts').select('*').gte('start_time', monthStart).lte('start_time', monthEnd),
            supabase.from('attendance').select('*').gte('check_in', monthStart).lte('check_in', monthEnd),
        ]);

        const allEmployees = profilesRes.data || [];
        const allShifts = shiftsRes.data || [];
        const allAttendance = attRes.data || [];
        setEmployees(allEmployees);

        const empDailyMap: Record<string, Record<string, any>> = {};
        for (const emp of allEmployees) {
            empDailyMap[emp.id] = {};
        }

        let presCount = 0, absCount = 0, offCount = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;

            for (const emp of allEmployees) {
                const shift = allShifts.find(
                    (s: any) => s.employee_id === emp.id && s.start_time.startsWith(dateStr)
                );

                if (!shift) {
                    offCount++;
                    empDailyMap[emp.id][dateStr] = { hours: 0, punctuality: 'off' };
                    continue;
                }

                const att = allAttendance.find(
                    (a: any) => (a.shift_id === shift.id) || (a.employee_id === emp.id && a.check_in.startsWith(dateStr))
                );

                if (!att || !att.check_in) {
                    absCount++;
                    empDailyMap[emp.id][dateStr] = { hours: 0, punctuality: 'absent' };
                    continue;
                }

                presCount++;

                const checkInTime = new Date(att.check_in).getTime();
                const checkOutTime = att.check_out ? new Date(att.check_out).getTime() : Date.now();
                const hours = Math.round(((checkOutTime - checkInTime) / (1000 * 60 * 60)) * 100) / 100;

                const shiftStartMs = (() => {
                    const d2 = new Date(dateStr + 'T00:00:00');
                    const sD = new Date(shift.start_time);
                    d2.setHours(sD.getUTCHours(), sD.getUTCMinutes(), 0, 0);
                    return d2.getTime();
                })();

                const diffMin = (checkInTime - shiftStartMs) / (1000 * 60);
                let punct = 'onTime';
                if (diffMin < -PUNCTUALLY_GRACE_MINUTES) punct = 'early';
                else if (diffMin > PUNCTUALLY_GRACE_MINUTES) punct = 'late';

                empDailyMap[emp.id][dateStr] = { hours: Math.max(hours, 0), punctuality: punct };
            }
        }

        // --- 1. Monthly Total Hours per Employee (simple bar) ---
        const totalsData = allEmployees.map((emp) => {
            let total = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                total += empDailyMap[emp.id][dateStr]?.hours || 0;
            }
            return { name: emp.full_name, hours: Math.round(total * 100) / 100 };
        });
        setMonthlyTotals(totalsData);

        // --- 2. Daily Hours Trend (lines per employee) ---
        const trendData: any[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
            const row: any = { day: `${d}` };
            for (const emp of allEmployees) {
                row[emp.id] = empDailyMap[emp.id][dateStr]?.hours || 0;
            }
            trendData.push(row);
        }
        setDailyTrend(trendData);

        // --- 3. Punctuality per Employee ---
        const punctData = allEmployees.map((emp) => {
            let early = 0, onTime = 0, late = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                const p = empDailyMap[emp.id][dateStr]?.punctuality;
                if (p === 'early') early++;
                else if (p === 'onTime') onTime++;
                else if (p === 'late') late++;
            }
            return { name: emp.full_name, Early: early, 'On Time': onTime, Late: late };
        });
        setPunctuality(punctData);

        // --- 4. Donut ---
        setDonut([
            { name: 'Present', value: presCount, color: '#10b981' },
            { name: 'Absent', value: absCount, color: '#ef4444' },
            { name: 'Off', value: offCount, color: '#cbd5e1' },
        ].filter(d => d.value > 0));

        // --- 5. Weekly Trend ---
        const weeklyEmpMap: Record<string, Record<number, number>> = {};
        for (const emp of allEmployees) weeklyEmpMap[emp.id] = {};
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
            const wk = Math.ceil(d / 7);
            for (const emp of allEmployees) {
                const hrs = empDailyMap[emp.id][dateStr]?.hours || 0;
                weeklyEmpMap[emp.id][wk] = (weeklyEmpMap[emp.id][wk] || 0) + hrs;
            }
        }
        const weekKeys = [...new Set(Object.values(weeklyEmpMap).flatMap(w => Object.keys(w)))].sort((a, b) => parseInt(a) - parseInt(b));
        const weeklyData = weekKeys.map((wk) => {
            const row: any = { week: `W${wk}` };
            for (const emp of allEmployees) {
                row[emp.id] = Math.round((weeklyEmpMap[emp.id][parseInt(wk)] || 0) * 100) / 100;
            }
            return row;
        });
        setWeeklyTrend(weeklyData);

        // --- 6. Heatmap ---
        const heatRows = allEmployees.map((emp) => {
            const cells: any[] = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
                cells.push({ day: d, hours: empDailyMap[emp.id][dateStr]?.hours ?? 0 });
            }
            return { name: emp.full_name, cells };
        });
        setHeatmap(heatRows);

        setLoading(false);
    }, [selectedMonth, supabase]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const empKeys = employees.map(e => e.id);
    const allHourVals = dailyTrend.flatMap(d => empKeys.map(k => d[k] || 0));
    const maxHours = Math.max(...allHourVals, 1);

    const heatIntensity = (hours: number) => {
        if (hours === 0) return 'bg-slate-100 text-slate-400';
        const r = Math.min(hours / (maxHours || 1), 1);
        if (r < 0.25) return 'bg-indigo-200 text-slate-700';
        if (r < 0.5) return 'bg-indigo-400 text-white';
        if (r < 0.75) return 'bg-indigo-600 text-white';
        return 'bg-indigo-800 text-white';
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 font-sans pb-32">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-medium tracking-tight text-slate-900">Attendance Graphs</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Per-employee color-coded analytics
                    </p>
                </div>
                <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-100">
                    <Calendar size={16} className="text-slate-400" />
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                    />
                </div>
            </header>

            {loading ? (
                <div className="py-32 flex flex-col items-center justify-center gap-4 opacity-30">
                    <Loader2 className="animate-spin text-slate-900" size={32} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Crunching Numbers...</p>
                </div>
            ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

                    {/* 1. Monthly Totals — Simple horizontal bar, one per employee */}
                    <GraphCard icon={<BarChart3 size={18} />} title="Total Hours — This Month" subtitle="Easiest way to compare everyone at a glance">
                        <ResponsiveContainer width="100%" height={Math.max(200, employees.length * 40)}>
                            <BarChart data={monthlyTotals} layout="vertical" barCategoryGap={6}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}h`} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#1e293b' }} width={140} />
                                <Tooltip
                                    formatter={(value: any) => [`${Number(value).toFixed(1)}h`, 'Total Hours']}
                                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                                />
                                <Bar dataKey="hours" radius={[0, 6, 6, 0]}>
                                    {monthlyTotals.map((_, idx) => (
                                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </GraphCard>

                    {/* 2. Daily Trend — Line chart, one line per employee */}
                    <GraphCard icon={<TrendingUp size={18} />} title="Daily Hours Trend" subtitle="Hours per day — follow each employee&apos;s line across the month">
                        <ResponsiveContainer width="100%" height={320}>
                            <LineChart data={dailyTrend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={3} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}h`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                                />
                                <Legend
                                    wrapperStyle={{ fontSize: 11 }}
                                    formatter={(value: string) => employees.find(e => e.id === value)?.full_name || value}
                                />
                                {empKeys.map((key, idx) => (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        name={employees.find(e => e.id === key)?.full_name}
                                        stroke={COLORS[idx % COLORS.length]}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </GraphCard>

                    {/* 3. Punctuality per Employee */}
                    <GraphCard icon={<Clock size={18} />} title="Punctuality per Employee" subtitle="How many days each person was Early / On Time / Late">
                        <ResponsiveContainer width="100%" height={Math.max(200, employees.length * 36)}>
                            <BarChart data={punctuality} layout="vertical" barCategoryGap={6}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#1e293b' }} width={140} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                <Bar dataKey="Early" fill="#10b981" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="On Time" fill="#6366f1" />
                                <Bar dataKey="Late" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </GraphCard>

                    {/* 4. Weekly Trend + Donut */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <GraphCard icon={<TrendingUp size={18} />} title="Weekly Trend" subtitle="Total hours per week, per employee">
                            <ResponsiveContainer width="100%" height={280}>
                                <LineChart data={weeklyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}h`} />
                                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                                    <Legend
                                        wrapperStyle={{ fontSize: 11 }}
                                        formatter={(value: string) => employees.find(e => e.id === value)?.full_name || value}
                                    />
                                    {empKeys.map((key, idx) => (
                                        <Line
                                            key={key}
                                            type="monotone"
                                            dataKey={key}
                                            name={employees.find(e => e.id === key)?.full_name}
                                            stroke={COLORS[idx % COLORS.length]}
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                            activeDot={{ r: 5 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </GraphCard>

                        <GraphCard icon={<PieChart size={18} />} title="Attendance Breakdown" subtitle="Present vs Absent vs Off (all employees combined)">
                            <ResponsiveContainer width="100%" height={280}>
                                <RePieChart>
                                    <Pie
                                        data={donut}
                                        cx="50%" cy="50%"
                                        innerRadius={65} outerRadius={105}
                                        paddingAngle={4}
                                        dataKey="value"
                                    >
                                        {donut.map((entry, idx) => (
                                            <Cell key={idx} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value, name) => [value ?? 0, name]} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                                    <Legend
                                        wrapperStyle={{ fontSize: 11 }}
                                        formatter={(value: string) => {
                                            const entry = donut.find(d => d.name === value);
                                            const total = donut.reduce((s: number, d: any) => s + d.value, 0);
                                            const pct = entry ? ((entry.value / total) * 100).toFixed(1) : '0';
                                            return `${value} (${pct}%)`;
                                        }}
                                    />
                                </RePieChart>
                            </ResponsiveContainer>
                        </GraphCard>
                    </div>

                    {/* 5. Hours Heatmap */}
                    <GraphCard icon={<Grid3x3 size={18} />} title="Hours Heatmap" subtitle="Rows = employees, Columns = days — darker cell = more hours worked">
                        <div className="overflow-x-auto p-2">
                            <div className="inline-grid gap-1" style={{
                                gridTemplateColumns: `130px repeat(${dailyTrend.length}, 36px)`,
                            }}>
                                <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest pb-1 flex items-end" />
                                {dailyTrend.map((d, ci) => (
                                    <div key={ci} className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center pb-1">
                                        {d.day}
                                    </div>
                                ))}
                                {heatmap.map((row, ri) => (
                                    <>
                                        <div className="text-[10px] font-bold text-slate-600 truncate pr-2 flex items-center">
                                            {row.name}
                                        </div>
                                        {row.cells.map((cell: any, ci: number) => (
                                            <div
                                                key={ci}
                                                className={`aspect-square rounded flex items-center justify-center text-[9px] font-bold ${heatIntensity(cell.hours)}`}
                                                title={`${row.name} — Day ${cell.day}: ${cell.hours.toFixed(1)}h`}
                                            >
                                                {cell.hours > 0 ? cell.hours.toFixed(1) : ''}
                                            </div>
                                        ))}
                                    </>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 mt-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                <span>0h</span>
                                <div className="w-4 h-4 rounded bg-slate-100" />
                                <div className="w-4 h-4 rounded bg-indigo-200" />
                                <div className="w-4 h-4 rounded bg-indigo-400" />
                                <div className="w-4 h-4 rounded bg-indigo-600" />
                                <div className="w-4 h-4 rounded bg-indigo-800" />
                                <span>{maxHours.toFixed(1)}h</span>
                            </div>
                        </div>
                    </GraphCard>

                </motion.div>
            )}
        </div>
    );
}

function GraphCard({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }) {
    return (
        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
                <div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-sm">
                    {icon}
                </div>
                <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">{title}</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{subtitle}</p>
                </div>
            </div>
            <div className="p-4">
                {children}
            </div>
        </div>
    );
}
