'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getStaffAccess } from '@/lib/admin-client';

const changeSchema = z.object({
    id: z.uuid(), expected: z.enum(['admin', 'manager', 'employee']), role: z.enum(['admin', 'employee']),
});

export async function changeEmployeeRole(input: unknown) {
    const access = await getStaffAccess();
    if (access?.profile?.role !== 'admin') return { error: 'Administrator access required.' };
    const parsed = changeSchema.safeParse(input);
    if (!parsed.success) return { error: 'Choose an employee and a valid role.' };
    const { id, expected, role } = parsed.data;
    const { error } = await access.client.rpc('set_employee_role', { p_employee: id, p_expected: expected, p_role: role });
    if (error) {
        if (['42501', 'P0001', '22023'].includes(error.code)) return { error: error.message };
        return { error: 'Role change unavailable. Check the employee roles migration and try again.' };
    }
    revalidatePath('/admin/employees');
    return { success: true };
}
