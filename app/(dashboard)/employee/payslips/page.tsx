import { createClient } from '@/lib/supabase/server';
import EmployeePayslipsClient from '@/components/employee/EmployeePayslipsClient';

export default async function EmployeePayslipsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return <div>Please log in</div>;

    const { data: history } = await supabase
        .from('payroll_records')
        .select('*, profiles(full_name, email)')
        .eq('employee_id', user.id)
        .order('created_at', { ascending: false });

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-medium text-slate-900">Payslips</h1>
                <p className="text-sm text-slate-500 mt-2">View your pay history and download payslips</p>
            </header>
            <EmployeePayslipsClient history={history || []} />
        </div>
    );
}
