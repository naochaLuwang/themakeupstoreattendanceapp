import type { NextRequest } from 'next/server';
import { stationDevicePost } from '@/lib/attendance/stations/http';
export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
    return stationDevicePost(request, (await params).action);
}
