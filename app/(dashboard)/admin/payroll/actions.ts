'use server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function processPayroll(formData: FormData) {
    const supabase = await createClient();

    const employee_id = formData.get('employeeId') as string;
    const base_hours = parseFloat(formData.get('baseHours') as string) || 0;
    const overtime_pay = parseFloat(formData.get('overtime') as string) || 0;
    const bonus_pay = parseFloat(formData.get('bonus') as string) || 0;
    const deductions = parseFloat(formData.get('deductions') as string) || 0;
    const net_pay = parseFloat(formData.get('netPay') as string) || 0;
    const gross_pay = parseFloat(formData.get('grossPay') as string) || 0;

    // Capture the type (salary, advance, or bonus)
    const type = (formData.get('type') as string) || 'salary';

    const { error } = await supabase.from('payroll_records').insert({
        employee_id,
        month_year: new Date().toISOString().split('T')[0],
        base_hours,
        gross_pay,
        overtime_pay,
        bonus_pay,
        deductions,
        net_pay,
        type, // Added this field
        status: 'paid'
    });

    if (error) {
        console.error("DB Error:", error.message);
        throw new Error(error.message);
    }

    revalidatePath('/admin/payroll');
}