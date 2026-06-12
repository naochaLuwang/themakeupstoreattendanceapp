'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar, User, Clock, Loader2, FileDown, TrendingUp, AlertCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ConsolidatedOutputReport() {
    const supabase = createClient();
    const [employees, setEmployees] = useState<any[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // 'YYYY-MM'
    
    const [reportData, setReportData] = useState<any[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // Fetch initial employee list
    useEffect(() => {
        async function loadEmployees() {
            const { data } = await supabase.from('profiles').select('id, full_name, username').order('full_name');
            if (data) {
                setEmployees(data);
                if (data.length > 0) setSelectedEmployee(data[0].id);
            }
        }
        loadEmployees();
    }, [supabase]);

    const formatTimeOnly = (isoString: string) => {
        if (!isoString) return '—';
        return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const formatShiftTimeOnly = (isoString: string) => {
        if (!isoString) return '—';
        return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    };

    const formatDuration = (hoursDecimal: number) => {
        if (hoursDecimal <= 0) return '—';
        const h = Math.floor(hoursDecimal);
        const m = Math.round((hoursDecimal - h) * 60);
        if (h === 0) return `${m}m`;
        return `${h}h ${m}m`;
    };

    const fetchReport = useCallback(async () => {
        if (!selectedEmployee || !selectedMonth) return;
        setLoading(true);

        const year = parseInt(selectedMonth.split('-')[0]);
        const month = parseInt(selectedMonth.split('-')[1]) - 1; // 0-indexed month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const monthStart = `${selectedMonth}-01T00:00:00Z`;
        const monthEnd = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}T23:59:59Z`;

        const [shiftsRes, attRes] = await Promise.all([
            // Fetch Shifts
            supabase.from('shifts')
                .select('*')
                .eq('employee_id', selectedEmployee)
                .gte('start_time', monthStart)
                .lte('start_time', monthEnd),
            // Fetch Attendance
            supabase.from('attendance')
                .select('*')
                .eq('employee_id', selectedEmployee)
                .gte('check_in', monthStart)
                .lte('check_in', monthEnd)
        ]);

        const shifts = shiftsRes.data || [];
        const attendance = attRes.data || [];

        let totalWorkedHours = 0;
        let totalOvertimeHours = 0;
        let totalEarlyInHours = 0;
        let totalLateInHours = 0;
        let presentDays = 0;

        const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
            const dayNum = i + 1;
            const dateStr = `${selectedMonth}-${String(dayNum).padStart(2, '0')}`;
            
            // Find Shift
            const shift = shifts.find(s => s.start_time.startsWith(dateStr));
            
            // Find Attendance (Try matching by shift_id first, fallback to date match via check_in)
            const att = attendance.find(a => 
                (shift && a.shift_id === shift.id) || a.check_in.startsWith(dateStr)
            );

            let workedHours = 0;
            let earlyInHours = 0;
            let lateInHours = 0;
            let overtimeHours = 0;

            if (att && att.check_in) {
                presentDays++;
                const checkInTime = new Date(att.check_in).getTime();
                const checkOutTime = att.check_out ? new Date(att.check_out).getTime() : new Date().getTime(); // ongoing if no checkout
                
                // Calculate worked hours (either actual or ongoing)
                workedHours = (checkOutTime - checkInTime) / (1000 * 60 * 60);
                if (workedHours > 0) {
                    totalWorkedHours += workedHours;
                }

                if (shift) {
                    const shiftStartMs = (() => {
                        const d = new Date(dateStr + 'T00:00:00'); // start with local day at midnight
                        const sD = new Date(shift.start_time);
                        d.setHours(sD.getUTCHours(), sD.getUTCMinutes(), 0, 0); // Inject literal UI time into it
                        return d.getTime();
                    })();

                    const shiftEndMs = (() => {
                        const d = new Date(dateStr + 'T00:00:00'); 
                        const sD = new Date(shift.end_time);
                        d.setHours(sD.getUTCHours(), sD.getUTCMinutes(), 0, 0);
                        return d.getTime();
                    })();

                    // Calculate Early In
                    if (checkInTime < shiftStartMs) {
                        earlyInHours = (shiftStartMs - checkInTime) / (1000 * 60 * 60);
                        if(earlyInHours > 0) totalEarlyInHours += earlyInHours;
                    }

                    // Calculate Late In
                    if (checkInTime > shiftStartMs) {
                        lateInHours = (checkInTime - shiftStartMs) / (1000 * 60 * 60);
                        if(lateInHours > 0) totalLateInHours += lateInHours;
                    }

                    // Calculate Overtime (Late Out)
                    if (att.check_out && checkOutTime > shiftEndMs) {
                        overtimeHours = (checkOutTime - shiftEndMs) / (1000 * 60 * 60);
                        if(overtimeHours > 0) totalOvertimeHours += overtimeHours;
                    }
                }
            }

            return {
                date: dateStr,
                displayDate: new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' }),
                shift: shift ? `${formatShiftTimeOnly(shift.start_time)} - ${formatShiftTimeOnly(shift.end_time)}` : 'Off',
                shift_label: shift?.shift_label || null,
                checkIn: att ? formatTimeOnly(att.check_in) : '—',
                checkOut: att?.check_out ? formatTimeOnly(att.check_out) : (att ? 'Active' : '—'),
                workedText: workedHours > 0 ? formatDuration(workedHours) : (att && !att.check_out ? 'Ongoing' : '—'),
                earlyIn: earlyInHours > 0 ? formatDuration(earlyInHours) : '—',
                lateIn: lateInHours > 0 ? formatDuration(lateInHours) : '—',
                overtime: overtimeHours > 0 ? formatDuration(overtimeHours) : '—'
            };
        });

        setReportData(dailyData);
        setSummary({
            totalWorked: formatDuration(totalWorkedHours),
            totalEarlyIn: formatDuration(totalEarlyInHours),
            totalLateIn: formatDuration(totalLateInHours),
            totalOvertime: formatDuration(totalOvertimeHours),
            presentDays,
            totalDays: daysInMonth
        });

        setLoading(false);
    }, [selectedEmployee, selectedMonth, supabase]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const exportToPDF = () => {
        const doc = new jsPDF();
        const empName = employees.find(e => e.id === selectedEmployee)?.full_name || 'Employee';
        const pageW = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42);
        doc.text('Consolidated Attendance Report', 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Employee: ${empName}     Month: ${selectedMonth}`, 14, 30);

        // Divider line
        doc.setDrawColor(226, 232, 240);
        doc.line(14, 35, pageW - 14, 35);

        // Summary Metrics Box
        const metrics = [
            { label: 'Total Worked', value: summary.totalWorked, color: [99, 102, 241] },
            { label: 'Early In', value: summary.totalEarlyIn, color: [16, 185, 129] },
            { label: 'Late In', value: summary.totalLateIn, color: [249, 115, 22] },
            { label: 'Overtime', value: summary.totalOvertime, color: [245, 158, 11] },
            { label: 'Present', value: `${summary.presentDays} / ${summary.totalDays}`, color: [59, 130, 246] },
        ];

        // Filled background for metrics
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 40, pageW - 28, 14, 2, 2, 'F');

        let mx = 20;
        const swatchW = 4;
        const gap = (pageW - 40) / metrics.length;
        metrics.forEach((m) => {
            doc.setFillColor(m.color[0], m.color[1], m.color[2]);
            doc.rect(mx, 44, swatchW, swatchW, 'F');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text(m.label, mx + 7, 47);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(m.value, mx + 7, 53);
            doc.setFont('helvetica', 'normal');
            mx += gap;
        });

        autoTable(doc, {
            startY: 62,
            headStyles: { fillColor: [15, 23, 42] }, // slate-900
            head: [['Date', 'Shift', 'Check In', 'Check Out', 'Early In', 'Late In', 'Overtime', 'Total Worked']],
            body: reportData.map(row => [
                row.displayDate,
                row.shift,
                row.checkIn,
                row.checkOut,
                row.earlyIn,
                row.lateIn,
                row.overtime,
                row.workedText
            ]),
        });

        doc.save(`${empName.replace(/\s+/g, '_')}_${selectedMonth}_Report.pdf`);
    };

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-8 font-sans pb-32">
            {/* Header & Controls */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                    <h1 className="text-3xl font-medium tracking-tight text-slate-900">Consolidated Output</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Detailed monthly attendance metrics
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-100">
                        <User size={16} className="text-slate-400" />
                        <select 
                            value={selectedEmployee} 
                            onChange={(e) => setSelectedEmployee(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                            ))}
                        </select>
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
                </div>
            </header>

            {loading ? (
                <div className="py-32 flex flex-col items-center justify-center gap-4 opacity-30">
                    <Loader2 className="animate-spin text-slate-900" size={32} />
                    <p className="text-[10px] font-black uppercase tracking-widest">Calculating Metrics...</p>
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
                        
                        {/* Summary Cards */}
                        {summary && (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <SummaryCard label="Total Worked" value={summary.totalWorked} icon={<Clock size={20} />} color="indigo" />
                                <SummaryCard label="Total Early In" value={summary.totalEarlyIn} icon={<TrendingUp size={20} />} color="emerald" />
                                <SummaryCard label="Total Late In" value={summary.totalLateIn} icon={<Clock size={20} />} color="orange" />
                                <SummaryCard label="Total Overtime" value={summary.totalOvertime} icon={<AlertCircle size={20} />} color="amber" />
                                <SummaryCard label="Days Present" value={`${summary.presentDays} / ${summary.totalDays}`} icon={<Calendar size={20} />} color="blue" />
                            </div>
                        )}

                        {/* Data Table */}
                        <div className="bg-white border border-slate-100 rounded-[2rem] shadow-sm overflow-hidden">
                            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">Daily Breakdown</h3>
                                <button 
                                    onClick={exportToPDF}
                                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-md"
                                >
                                    <FileDown size={14} /> Export PDF
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left min-w-[800px]">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Shift Schedule</th>
                                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Check In</th>
                                            <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Check Out</th>
                                            <th className="px-6 py-4 text-[9px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50/30">Early In</th>
                                            <th className="px-6 py-4 text-[9px] font-black text-orange-500 uppercase tracking-widest bg-orange-50/30">Late In</th>
                                            <th className="px-6 py-4 text-[9px] font-black text-amber-500 uppercase tracking-widest bg-amber-50/30">Overtime</th>
                                            <th className="px-6 py-4 text-[9px] font-black text-slate-900 uppercase tracking-widest bg-slate-100/50">Total Worked</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {reportData.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="text-xs font-bold text-slate-900">{row.displayDate}</span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`text-[10px] font-bold uppercase ${row.shift === 'Off' ? 'text-rose-400' : 'text-slate-500'}`}>
                                                        {row.shift} 
                                                        {row.shift_label && <span className="ml-1 opacity-50">({row.shift_label})</span>}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-600">{row.checkIn}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-600">
                                                    {row.checkOut === 'Active' ? <span className="text-emerald-500 font-bold animate-pulse">Active</span> : row.checkOut}
                                                </td>
                                                
                                                {/* Early In Column */}
                                                <td className="px-6 py-4 whitespace-nowrap bg-emerald-50/10">
                                                    <span className={`text-xs font-black ${row.earlyIn !== '—' ? 'text-emerald-600' : 'text-slate-300'}`}>
                                                        {row.earlyIn}
                                                    </span>
                                                </td>

                                                {/* Late In Column */}
                                                <td className="px-6 py-4 whitespace-nowrap bg-orange-50/10">
                                                    <span className={`text-xs font-black ${row.lateIn !== '—' ? 'text-orange-600' : 'text-slate-300'}`}>
                                                        {row.lateIn}
                                                    </span>
                                                </td>

                                                {/* Overtime Column */}
                                                <td className="px-6 py-4 whitespace-nowrap bg-amber-50/10">
                                                    <span className={`text-xs font-black ${row.overtime !== '—' ? 'text-amber-600' : 'text-slate-300'}`}>
                                                        {row.overtime}
                                                    </span>
                                                </td>

                                                {/* Total Worked */}
                                                <td className="px-6 py-4 whitespace-nowrap bg-slate-50/30">
                                                    <span className="text-sm font-black text-indigo-600 tracking-tight">
                                                        {row.workedText}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                </AnimatePresence>
            )}
        </div>
    );
}

function SummaryCard({ label, value, icon, color }: any) {
    const colors: any = {
        indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber: 'bg-amber-50 text-amber-600 border-amber-100',
        blue: 'bg-blue-50 text-blue-600 border-blue-100',
        orange: 'bg-orange-50 text-orange-600 border-orange-100',
    };
    
    return (
        <div className={`p-6 rounded-3xl border ${colors[color]} flex flex-col items-start gap-4`}>
            <div className="p-3 bg-white/60 rounded-2xl shadow-sm">
                {icon}
            </div>
            <div>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-60 mb-1">{label}</p>
                <p className="text-2xl font-black tracking-tighter leading-none">{value}</p>
            </div>
        </div>
    );
}
