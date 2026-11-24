import type { Metadata } from 'next';
import '@/components/workspace.css';
import './station.css';
import AttendanceStationDisplay from '@/components/attendance-stations/AttendanceStationDisplay';
export const metadata: Metadata = { title: 'Attendance station', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function AttendanceStationPage({ searchParams }: { searchParams: Promise<{ station?: string }> }) {
    const { station } = await searchParams;
    const valid = typeof station === 'string' && /^[a-f0-9-]{36}$/i.test(station);
    return <AttendanceStationDisplay stationId={valid ? station! : null} />;
}
