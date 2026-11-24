'use server';
import { revalidatePath } from 'next/cache';
import { stationAdminCommand, stationAdminList } from '@/lib/attendance/stations/server';
import type { StationAdminCommand } from '@/lib/attendance/stations/types';
export async function loadAttendanceStations() { return stationAdminList(); }
export async function manageAttendanceStation(command: StationAdminCommand) {
    const result = await stationAdminCommand(command);
    if (result.success) revalidatePath('/admin/attendance-stations');
    return result;
}
