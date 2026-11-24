import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { stationAdminList } from '@/lib/attendance/stations/server';
import AttendanceStationManagement from '@/components/attendance-stations/AttendanceStationManagement';
import './stations.css';
export default async function AttendanceStationsPage() {
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) redirect('/login');
    const { data: profile } = await client.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return <div role="alert"><h1>Administrator access required</h1><p>An administrator authorizes and manages attendance displays.</p></div>;
    return <AttendanceStationManagement initial={await stationAdminList()} />;
}
