import { createClient } from '@/lib/supabase/server';
import LeaveManagementWrapper from '@/components/admin/LeaveManagementWrapper';
import { redirect } from 'next/navigation';

export default async function AdminLeavesPage() {
    const supabase = await createClient();

    // 1. Get the current user session
    const { data: { user } } = await supabase.auth.getUser();

    // Safety check: Redirect if no user
    if (!user) redirect('/login');

    // 2. Fetch the employee list for the filters
    // We assign this to the 'employees' variable
    const { data: employees } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'employee');

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Leave Management</h1>
                <p className="text-sm font-medium text-slate-400">Manage time-off requests across your entire staff</p>
            </header>

            {/* Now 'user' and 'employees' are defined and can be passed here */}
            <LeaveManagementWrapper adminId={user.id} employees={employees || []} />
        </div>
    );
}