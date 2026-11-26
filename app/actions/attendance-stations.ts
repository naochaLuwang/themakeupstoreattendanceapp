'use server';
import { revalidatePath } from 'next/cache';
import { stationAdminCommand, stationAdminList } from '@/lib/attendance/stations/server';
import type { StationAdminCommand } from '@/lib/attendance/stations/types';
import { saveSmartScanSettings, type SmartScanSettingsCommand } from '@/lib/attendance/smart-scan/settings';
export async function loadAttendanceStations() { return stationAdminList(); }
export async function manageAttendanceStation(command: StationAdminCommand) {
    const result = await stationAdminCommand(command);
    if (result.success) revalidatePath('/admin/attendance-stations');
    return result;
}
export async function updateBranchSmartScan(command: SmartScanSettingsCommand) {
    const result = await saveSmartScanSettings(command);
    if (result.success) {
        revalidatePath('/admin/attendance-stations');
        revalidatePath('/employee');
        revalidatePath('/employee/smart-scan');
    }
    return result;
}
