import { createClient } from '@/lib/supabase/server';
import PayrollTable from './PayrollTable';
import PayrollHistory from './History';
import AdvanceForm from './AdvanceForm';

export default async function PayrollPage() {
    const supabase = await createClient();

    // 1. Time Boundaries (Current Calendar Month)
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthStart = new Date(year, month, 1).toISOString();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    // 2. Fetch Live Accurate Data
    const { data: profilesData } = await supabase.from('profiles').select('id, hourly_rate, email, full_name').eq('role', 'employee').order('full_name');
    const { data: attendanceData } = await supabase.from('attendance').select('*').gte('check_in', monthStart).lte('check_in', monthEnd);
    const { data: historyData } = await supabase
        .from('payroll_records')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

    const { data: shiftsData } = await supabase.from('shifts').select('*').gte('start_time', monthStart).lte('start_time', monthEnd);

    // 3. Perfect Javascript Aggregation for Accurate Hours
    const accurateData = profilesData?.map(profile => {
        const empAttendance = attendanceData?.filter(a => a.employee_id === profile.id) || [];
        const empShifts = shiftsData?.filter(s => s.employee_id === profile.id) || [];
        
        let totalWorkedHours = 0;
        let totalOvertimeHours = 0;

        empAttendance.forEach(att => {
            if (att.check_in && att.check_out) {
                const ms = new Date(att.check_out).getTime() - new Date(att.check_in).getTime();
                totalWorkedHours += Math.max(0, ms / (1000 * 60 * 60));

                const shift = empShifts.find(s => s.id === att.shift_id);
                if (shift) {
                    const checkOutTime = new Date(att.check_out).getTime();
                    const dateStr = att.check_in.split('T')[0];
                    const shiftEndMs = (() => {
                        const d = new Date(dateStr + 'T00:00:00'); 
                        const sD = new Date(shift.end_time);
                        d.setHours(sD.getUTCHours(), sD.getUTCMinutes(), 0, 0);
                        return d.getTime();
                    })();
                    if (checkOutTime > shiftEndMs) {
                        const ot = (checkOutTime - shiftEndMs) / (1000 * 60 * 60);
                        if (ot > 0) totalOvertimeHours += ot;
                    }
                }
            }
        });

        return {
            employee_id: profile.id,
            full_name: profile.full_name,
            profile: profile,
            total_hours: Math.round(totalWorkedHours),
            total_ot: Math.round(totalOvertimeHours * 10) / 10
        };
    }) || [];

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-10 pb-20">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-6xl font-black tracking-tighter italic text-slate-900">Payroll.</h1>
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mt-3">Compensation Management</p>
                </div>
                <div className="w-full md:w-96">
                    <AdvanceForm profiles={profilesData || []} />
                </div>
            </header>

            <section>
                <div className="flex items-center gap-4 mb-6">
                    <h2 className="text-xs font-black uppercase text-indigo-500 tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" /> Pending Settlements
                    </h2>
                    <span className="text-[8px] font-black tracking-widest uppercase bg-indigo-50 text-indigo-400 px-2 py-1 rounded-md">
                        Dynamic Engine
                    </span>
                </div>
                <PayrollTable initialData={accurateData} history={historyData || []} />
            </section>

            <PayrollHistory history={historyData || []} />
        </div>
    );
}