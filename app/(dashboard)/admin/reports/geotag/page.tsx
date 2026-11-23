import { createClient } from '@/lib/supabase/server';
import GeotagAnalysisClient from '@/components/admin/GeotagAnalysisClient';

export default async function GeotagReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
    const supabase = await createClient();

    // Leverage Next.js query parameters for historical time-travel bounds
    const { date } = await searchParams;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const targetDate = date || today;

    const { data: attendanceData } = await supabase
        .from('attendance')
        .select(`
            id, check_in, check_out, check_in_lat, check_in_lng, is_within_geofence,
            profiles (full_name, role),
            stores (name, lat, lng, radius_meters)
        `)
        .gte('check_in', `${targetDate}T00:00:00Z`)
        .lte('check_in', `${targetDate}T23:59:59Z`)
        .order('check_in', { ascending: false });

    return (
        <div className="space-y-8">
            <header className="mb-6 md:mb-8 mt-4 md:mt-0">
                <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-[2px] bg-indigo-500" />
                    <p className="text-sm font-medium text-indigo-500 tracking-normal">Attendance locations</p>
                </div>
                <h1 className="text-3xl md:text-3xl font-medium text-slate-900 tracking-normal">Location audit</h1>
                <p className="text-xs font-medium text-slate-500 mt-2 max-w-xl">
                    Review clock-in locations and store geofence checks for {targetDate}.
                </p>
            </header>

            <GeotagAnalysisClient records={attendanceData || []} selectedDate={targetDate} />
        </div>
    );
}
