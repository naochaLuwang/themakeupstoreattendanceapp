import { createClient } from '@/lib/supabase/server';
import { Clock, Download, User, ShieldAlert, Timer } from 'lucide-react';

// Formatter to handle the time conversion
function formatDuration(decimalHours: number | string | null) {
    if (!decimalHours || Number(decimalHours) === 0) return "0m";
    const totalMinutes = Math.round(Number(decimalHours) * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export default async function MonthlyHoursReport() {
    const supabase = await createClient();
    const { data: stats, error } = await supabase
        .from('monthly_employee_stats')
        .select('*')
        .order('total_hours', { ascending: false });

    if (error) return <div className="p-10 font-black text-rose-500">{error.message}</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10">
            <header className="flex justify-between items-center">
                <h1 className="text-6xl font-black tracking-tighter italic">Time Audit.</h1>
                <div className="flex gap-4">
                    <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-slate-400">Total Personnel</p>
                        <p className="text-xl font-black">{stats?.length || 0}</p>
                    </div>
                </div>
            </header>

            <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl overflow-hidden">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-500">Employee</th>
                            <th className="px-6 py-6 text-[10px] font-black uppercase text-slate-500 text-center">Total Worked</th>
                            <th className="px-6 py-6 text-[10px] font-black uppercase text-rose-500 text-center border-l">Late Duration</th>
                            <th className="px-6 py-6 text-[10px] font-black uppercase text-emerald-500 text-center border-l">Early Duration</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {stats?.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-bold text-xs uppercase">
                                            {row.full_name?.substring(0, 2)}
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900 leading-none">{row.full_name}</p>
                                            <p className="text-[10px] font-black text-slate-400 uppercase mt-1">@{row.username}</p>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-6 text-center">
                                    <span className="text-lg font-black text-indigo-600">
                                        {formatDuration(row.total_hours)}
                                    </span>
                                </td>

                                {/* LATE TIME SECTION */}
                                <td className="px-6 py-6 border-l bg-rose-50/20">
                                    <div className="flex justify-center gap-6">
                                        <TimeBlock label="Late In" time={formatDuration(row.total_late_in_hrs)} isWarning={row.total_late_in_hrs > 0} />
                                        <TimeBlock label="Late Out" time={formatDuration(row.total_late_out_hrs)} />
                                    </div>
                                </td>

                                {/* EARLY TIME SECTION */}
                                <td className="px-6 py-6 border-l bg-emerald-50/20">
                                    <div className="flex justify-center gap-6">
                                        <TimeBlock label="Early In" time={formatDuration(row.total_early_in_hrs)} />
                                        <TimeBlock label="Early Out" time={formatDuration(row.total_early_out_hrs)} isWarning={row.total_early_out_hrs > 0} />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function TimeBlock({ label, time, isWarning }: { label: string, time: string, isWarning?: boolean }) {
    return (
        <div className="text-center">
            <p className="text-[8px] font-black uppercase text-slate-400 mb-1">{label}</p>
            <p className={`text-sm font-black tracking-tight ${isWarning ? 'text-rose-600' : 'text-slate-400'}`}>
                {time === '0m' ? '—' : time}
            </p>
        </div>
    );
}