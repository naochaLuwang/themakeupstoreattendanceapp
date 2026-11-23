'use client';
import { createClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useState, useMemo, type ReactNode } from 'react';
import type { Database } from '@/lib/supabase/database.types';
import AdminPageSkeleton from './AdminPageSkeleton';
import {
    AlertCircle, UserCheck, ArrowUpRight,
    Clock, Users
} from 'lucide-react';

type LiveAttendance = Database['public']['Tables']['attendance']['Row'] & {
    profiles: { full_name: string | null } | null;
    shifts: { shift_label: string | null; start_time: string; end_time: string | null } | null;
};

export default function LiveStatusList() {
    const supabase = useMemo(() => createClient(), []);
    const [liveAttendance, setLiveAttendance] = useState<LiveAttendance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());

    // Update 'now' every minute to keep OT calculations live
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const fetchLive = useCallback(async () => {
        // IMPORTANT: We use the exact foreign key relation name 'shifts'
        const { data, error } = await supabase
            .from('attendance')
            .select(`
                *,
                profiles (full_name),
                shifts (shift_label, start_time, end_time)
            `)
            .is('check_out', null)
            .overrideTypes<LiveAttendance[], { merge: false }>();

        if (error) {
            setError('Attendance couldn’t be loaded. Please try again.');
        } else {
            setError(null);
            setLiveAttendance(data || []);
        }
        setLoading(false);
    }, [supabase]);

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
    }, [fetchLive, supabase]);

    // --- LOGIC HELPERS ---
    // Safe literal extraction from "YYYY-MM-DDTHH:mm:00+05:30" or "YYYY-MM-DD HH:mm:00"
    const extractLocalTime = (timeString: string | null) => {
        if (!timeString) return null;
        try {
            if (timeString.includes('T')) {
                return timeString.split('T')[1].substring(0, 5); // "HH:mm"
            } else if (timeString.includes(' ')) {
                return timeString.split(' ')[1].substring(0, 5);
            }
        } catch {
             return null;
        }
        return null;
    };

    const getScheduledTime = (attendanceIn: string, shiftTime: string | null | undefined) => {
        if (!shiftTime) return null;
        const actualDate = new Date(attendanceIn); // Actual local check-in
        const literalTime = extractLocalTime(shiftTime); // "10:00"
        if (!literalTime) return null;

        const [hours, minutes] = literalTime.split(':').map(Number);
        const combined = new Date(actualDate);
        // Set the exact local hours/mins the admin intended
        combined.setHours(hours, minutes, 0, 0);
        return combined;
    };

    const formatDuration = (mins: number) => {
        const abs = Math.abs(mins);
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    // Format for display (10:00 -> 10:00 AM)
    const formatTime12H = (iso: string | null | undefined) => {
        const time24 = extractLocalTime(iso ?? null);
        if (!time24) return '--:--';
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
    };

    // Fallback format for actual Date objects (check_in)
    const formatActualTime = (iso: string | null) => {
        if (!iso) return '--:--';
        return new Date(iso).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    };

    if (loading) return <AdminPageSkeleton />;

    return (
        <div className="space-y-6">
            {error && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-100 bg-rose-50 p-4 text-sm text-rose-600">
                    <span>{error}</span>
                    <button type="button" onClick={() => { setLoading(true); void fetchLive(); }} className="rounded-lg border border-rose-200 px-3 py-2 font-medium">Retry</button>
                </div>
            )}
            {/* Header Stats */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-slate-900">
                    <Users size={18} />
                    <span className="text-sm font-medium">On the floor</span>
                </div>
                <span className="text-sm text-slate-600" aria-live="polite">
                    {liveAttendance.length} present
                </span>
            </div>

            {liveAttendance.length === 0 && !error ? (
                <div className="py-16 px-4 text-center rounded-lg bg-slate-50">
                    <Users size={24} className="mx-auto mb-4 text-slate-500" aria-hidden="true" />
                    <p className="text-sm font-medium text-slate-900">No staff are clocked in</p>
                    <p className="text-sm text-slate-500 mt-2">Staff will appear here when they start their shifts</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                        {liveAttendance.map((record) => {
                            const actualIn = new Date(record.check_in);
                            const schedStart = getScheduledTime(record.check_in, record.shifts?.start_time);
                            const schedEnd = getScheduledTime(record.check_in, record.shifts?.end_time);

                            const diffIn = schedStart ? Math.floor((actualIn.getTime() - schedStart.getTime()) / 60000) : 0;
                            const isOvertime = schedEnd && now > schedEnd;
                            const otMins = isOvertime ? Math.floor((now.getTime() - schedEnd.getTime()) / 60000) : 0;

                            return (
                                <div
                                    key={record.id}
                                    className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col gap-4"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="admin-staff-avatar">
                                            {record.profiles?.full_name?.charAt(0) || '—'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 break-words">{record.profiles?.full_name || 'Staff member'}</p>
                                            <p className="text-xs text-slate-500 font-medium tracking-normal">
                                                {record.shifts?.shift_label || 'Unscheduled shift'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 text-emerald-600 shrink-0">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                                            <span className="text-xs">On duty</span>
                                        </div>
                                    </div>

                                    {/* Shift Info Grid */}
                                    <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-2">
                                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                            <p className="text-xs font-medium text-slate-500 mb-1 tracking-normal">Scheduled</p>
                                            <p className="text-xs text-slate-800 flex flex-wrap gap-x-1">
                                                <span className="whitespace-nowrap">{formatTime12H(record.shifts?.start_time)}</span>
                                                <span aria-hidden="true">–</span>
                                                <span className="sr-only">to</span>
                                                <span className="whitespace-nowrap">{formatTime12H(record.shifts?.end_time)}</span>
                                            </p>
                                        </div>
                                        <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                                            <p className="text-xs font-medium text-slate-500 mb-1">Clocked in</p>
                                            <p className="text-xs text-slate-800 whitespace-nowrap">
                                                {formatActualTime(record.check_in)}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Status Section */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {schedStart && (
                                            diffIn > 0 ? (
                                                <Badge text={`Late by ${formatDuration(diffIn)}`} color="amber" icon={<AlertCircle size={14} />} />
                                            ) : (
                                                <Badge text={diffIn === 0 ? 'On time' : `Early by ${formatDuration(diffIn)}`} color="emerald" icon={<UserCheck size={14} />} />
                                            )
                                        )}
                                        {isOvertime && (
                                            <Badge text={`Overtime: ${formatDuration(otMins)}`} color="blue" icon={<ArrowUpRight size={14} />} />
                                        )}
                                        {!record.shifts && (
                                            <Badge text="No shift assigned" color="rose" icon={<Clock size={14} />} />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}

// --- COMPONENT UI ---
function Badge({ text, color, icon }: { text: string, color: 'amber' | 'emerald' | 'blue' | 'rose', icon: ReactNode }) {
    const styles = {
        amber: 'text-amber-600 bg-amber-50 border-amber-100',
        emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        blue: 'text-blue-600 bg-blue-50 border-blue-100',
        rose: 'text-rose-600 bg-rose-50 border-rose-100'
    };
    return (
        <span className={`flex items-center gap-1.5 text-xs font-medium  px-2.5 py-1 rounded-lg border ${styles[color]}`}>
            {icon}
            {text}
        </span>
    );
}
