'use server'

import { getAdminClient } from '@/lib/admin-client'
import { revalidatePath } from 'next/cache'

interface ManualAttendanceParams {
    employee_id: string
    shift_id: string
    date: string
    check_in_time: string
    check_out_time?: string
}

export async function createManualAttendance(params: ManualAttendanceParams) {
    try {
        const admin = await getAdminClient()

        const { employee_id, shift_id, date, check_in_time, check_out_time } = params

        if (!employee_id || !shift_id || !date || !check_in_time) {
            return { error: 'Employee, shift, date, and check-in time are required.' }
        }

        const { data: employee } = await admin
            .from('profiles')
            .select('id, store_id, full_name')
            .eq('id', employee_id)
            .single()

        if (!employee) return { error: 'Employee not found.' }

        const check_in = `${date}T${check_in_time}:00+00`
        const check_out = check_out_time ? `${date}T${check_out_time}:00+00` : null

        if (check_out && new Date(check_in) >= new Date(check_out)) {
            return { error: 'Check-in time must be before check-out time.' }
        }

        const { data: existing } = await admin
            .from('attendance')
            .select('id, check_in, check_out')
            .eq('employee_id', employee_id)
            .gte('check_in', `${date}T00:00:00Z`)
            .lte('check_in', `${date}T23:59:59Z`)
            .limit(1)
            .maybeSingle()

        if (existing) {
            return { error: `Attendance already exists for ${employee.full_name} on ${date}. Use edit to modify.` }
        }

        const { data, error } = await admin.from('attendance').insert([{
            employee_id,
            shift_id,
            store_id: employee.store_id,
            check_in,
            check_out,
            check_in_lat: null,
            check_in_lng: null,
            is_within_geofence: false,
            is_auto_checkout: false,
        }]).select().single()

        if (error) return { error: error.message }

        revalidatePath('/admin/logs')
        return { success: true, data }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return { error: message }
    }
}

export async function updateManualAttendance(
    attendanceId: string,
    updates: { check_in?: string; check_out?: string | null; shift_id?: string }
) {
    try {
        const admin = await getAdminClient()

        if (!attendanceId) return { error: 'Attendance record ID is required.' }

        const { data: existing } = await admin
            .from('attendance')
            .select('id')
            .eq('id', attendanceId)
            .single()

        if (!existing) return { error: 'Attendance record not found.' }

        if (updates.check_in && updates.check_out) {
            if (new Date(updates.check_in) >= new Date(updates.check_out)) {
                return { error: 'Check-in time must be before check-out time.' }
            }
        }

        const { data, error } = await admin
            .from('attendance')
            .update(updates)
            .eq('id', attendanceId)
            .select()
            .single()

        if (error) return { error: error.message }

        revalidatePath('/admin/logs')
        return { success: true, data }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return { error: message }
    }
}

export async function deleteManualAttendance(attendanceId: string) {
    try {
        const admin = await getAdminClient()

        if (!attendanceId) return { error: 'Attendance record ID is required.' }

        const { error } = await admin
            .from('attendance')
            .delete()
            .eq('id', attendanceId)

        if (error) return { error: error.message }

        revalidatePath('/admin/logs')
        return { success: true }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return { error: message }
    }
}
