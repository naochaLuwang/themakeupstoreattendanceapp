import { createClient } from '@/lib/supabase/server';
import EmployeePayslipsClient from '@/components/employee/EmployeePayslipsClient';

export default async function EmployeePayslipsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch strict security: only their own specific history records!
    const { data: history } = await supabase
        .from('payroll_records')
        .select('*, profiles(full_name, email)')
        .eq('employee_id', user?.id)
        .order('created_at', { ascending: false });

    return (
        <div className="relative min-h-screen bg-[#FAFAFA] animate-in fade-in duration-700 pb-32">
            <header className="p-8 pt-16 relative z-10 border-b border-black/[0.03] bg-white">
                <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-[2px] bg-black" />
                    <p className="text-[10px] font-black text-black uppercase tracking-[0.4em]">Financial_Archive</p>
                </div>
                <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">Payslips.</h1>
            </header>

            <main className="p-6 relative z-10">
                <EmployeePayslipsClient history={history || []} />
            </main>
        </div>
    );
}
