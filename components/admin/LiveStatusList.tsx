'use client';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertCircle, UserCheck, ArrowUpRight,
    ArrowDownRight, Clock, Users
} from 'lucide-react';

export default function LiveStatusList() {
    const supabase = createClient();
    const [liveAttendance, setLiveAttendance] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());

    // Update 'now' every minute to keep OT calculations live
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchLive = async () => {
        // IMPORTANT: We use the exact foreign key relation name 'shifts'
        const { data, error } = await supabase
            .from('attendance')
            .select(`
                *,
                profiles (full_name),
                shifts (shift_label, start_time, end_time)
            `)
            .is('check_out', null);

        if (error) {
            console.error("Fetch Error:", error);
        } else {
            setLiveAttendance(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchLive();

        const channel = supabase.channel('live-updates')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'attendance'
            }, fetchLive)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // --- LOGIC HELPERS ---
    const getScheduledTime = (attendanceIn: string, shiftTime: string | null) => {
        if (!shiftTime) return null;
        const actualDate = new Date(attendanceIn);
        const dbDate = new Date(shiftTime);
        const combined = new Date(actualDate);
        // Extract exact hours/mins from DB regardless of local offset
        combined.setHours(dbDate.getUTCHours(), dbDate.getUTCMinutes(), 0, 0);
        return combined;
    };

    const formatDuration = (mins: number) => {
        const abs = Math.abs(mins);
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const formatTime = (iso: string | null, useUTC = false) => {
        if (!iso) return '--:--';
        return new Date(iso).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true,
            ...(useUTC && { timeZone: 'UTC' })
        });
    };

    if (loading) return <div className="p-10 text-center text-xs font-black uppercase tracking-widest animate-pulse text-slate-400">Syncing floor data...</div>;

    return (
        <div className="space-y-6">
            {/* Header Stats */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-slate-900">
                    <Users size={18} />
                    <span className="text-sm font-black uppercase tracking-tight">Active Floor Staff</span>
                </div>
                <span className="bg-black text-white text-[10px] font-black px-3 py-1 rounded-full">
                    {liveAttendance.length} Present
                </span>
            </div>

            {liveAttendance.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-slate-100 rounded-[3rem] text-slate-300 text-[10px] font-black uppercase tracking-[0.3em]">
                    No active staff on floor
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AnimatePresence>
                        {liveAttendance.map((record) => {
                            const actualIn = new Date(record.check_in);
                            const schedStart = getScheduledTime(record.check_in, record.shifts?.start_time);
                            const schedEnd = getScheduledTime(record.check_in, record.shifts?.end_time);

                            const diffIn = schedStart ? Math.floor((actualIn.getTime() - schedStart.getTime()) / 60000) : 0;
                            const isOvertime = schedEnd && now > schedEnd;
                            const otMins = isOvertime ? Math.floor((now.getTime() - schedEnd.getTime()) / 60000) : 0;

                            return (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={record.id}
                                    className="p-5 rounded-[2.5rem] border border-slate-100 bg-white shadow-sm flex flex-col gap-4"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center font-black text-sm shadow-xl">
                                            {record.profiles?.full_name?.charAt(0)}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{record.profiles?.full_name}</p>
                                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                                {record.shifts?.shift_label || 'Unscheduled Shift'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">Live</span>
                                        </div>
                                    </div>

                                    {/* Shift Info Grid */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                            <p className="text-[7px] font-black text-slate-400 uppercase mb-1 tracking-widest">Scheduled</p>
                                            <p className="text-[10px] font-black text-slate-800">
                                                {formatTime(record.shifts?.start_time, true)} - {formatTime(record.shifts?.end_time, true)}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                            <p className="text-[7px] font-black text-slate-400 uppercase mb-1 tracking-widest">Started At</p>
                                            <p className="text-[10px] font-black text-slate-800">
                                                {formatTime(record.check_in)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status Section */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {schedStart && (
                                            diffIn > 0 ? (
                                                <Badge text={`Late In: ${formatDuration(diffIn)}`} color="amber" icon={<AlertCircle size={10} />} />
                                            ) : (
                                                <Badge text={`Early In: ${formatDuration(diffIn)}`} color="emerald" icon={<UserCheck size={10} />} />
                                            )
                                        )}
                                        {isOvertime && (
                                            <Badge text={`Overtime: ${formatDuration(otMins)}`} color="blue" icon={<ArrowUpRight size={10} />} />
                                        )}
                                        {!record.shifts && (
                                            <Badge text="No Shift Assigned" color="rose" icon={<Clock size={10} />} />
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}

// --- COMPONENT UI ---
function Badge({ text, color, icon }: { text: string, color: 'amber' | 'emerald' | 'blue' | 'rose', icon: any }) {
    const styles = {
        amber: 'text-amber-600 bg-amber-50 border-amber-100',
        emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        blue: 'text-blue-600 bg-blue-50 border-blue-100',
        rose: 'text-rose-600 bg-rose-50 border-rose-100'
    };
    return (
        <span className={`flex items-center gap-1.5 text-[8px] font-black uppercase px-2.5 py-1 rounded-lg border ${styles[color]}`}>
            {icon}
            {text}
        </span>
    );
}