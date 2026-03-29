import { createClient } from '@/lib/supabase/server';
import GeotagAnalysisClient from '@/components/admin/GeotagAnalysisClient';

export default async function GeotagReportPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
    const supabase = await createClient();

    // Leverage Next.js query parameters for historical time-travel bounds
    const { date } = await searchParams;
    const targetDate = date || new Date().toISOString().split('T')[0];

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
        <div className="min-h-screen bg-[#FAFAFA] p-4 md:p-8 pb-24 md:pb-32">
            <header className="mb-6 md:mb-8 mt-4 md:mt-0">
                <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-[2px] bg-indigo-500" />
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em]">Geo_Spatial_Audit</p>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter">Live Operations Geotag.</h1>
                <p className="text-xs font-bold text-slate-400 mt-2 max-w-xl">
                    Validating geographical coordinates and compliance of all active shifts initiated on {targetDate}.
                </p>
            </header>

            <GeotagAnalysisClient records={attendanceData || []} selectedDate={targetDate} />
        </div>
    );
}
