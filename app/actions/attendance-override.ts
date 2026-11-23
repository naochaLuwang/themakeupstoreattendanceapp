'use server';
import { revalidatePath } from 'next/cache';
import { getAdminClient } from '@/lib/admin-client';

export async function approveOverrideRequest(requestId: string) {
    try {
        const adminClient = await getAdminClient();

        // Fetch the swap request with shift info
        const { data: request, error: reqError } = await adminClient
            .from('swap_requests')
            .select('*, shifts(*)')
            .eq('id', requestId)
            .single();

        if (reqError || !request) throw new Error("Request not found");

        if (!request.message?.includes('OVERRIDE REQUEST')) {
            throw new Error("Not an override request");
        }

        let targetDate = null;
        if (request.shifts?.start_time) {
            targetDate = request.shifts.start_time.split('T')[0];
        } else {
            const dateMatch = request.message.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) targetDate = dateMatch[0];
        }
        if (!targetDate) throw new Error("Could not determine date for override");

        const { data: attendance, error: attError } = await adminClient
            .from('attendance')
            .select('*')
            .eq('employee_id', request.requestor_id)
            .gte('check_in', `${targetDate}T00:00:00`)
            .lt('check_in', `${targetDate}T23:59:59`)
            .maybeSingle();

        if (attError) throw attError;
        if (!attendance) throw new Error("No attendance record found for that day");
        if (!attendance.check_out) throw new Error("Employee has not clocked out yet");

        const { error: updateError } = await adminClient
            .from('attendance')
            .update({ check_out: null })
            .eq('id', attendance.id);

        if (updateError) throw updateError;

        const { error: statusError } = await adminClient
            .from('swap_requests')
            .update({ status: 'approved' })
            .eq('id', requestId);

        if (statusError) throw statusError;

        revalidatePath('/admin');
        return { success: true };
    } catch (err: any) {
        console.error("Override approval error:", err);
        return { success: false, error: err.message };
    }
}