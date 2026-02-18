import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Define types to satisfy the TypeScript "any" errors
interface LeaveRequest {
    status: string | null;
    start_date: string;
    end_date: string;
}

interface SwapRequest {
    status: string | null;
}

interface EmployeeProfile {
    full_name: string | null;
    username: string | null;
    leave_requests: LeaveRequest[];
    swap_requests: SwapRequest[];
}

export async function GET() {
    // FIX 1: You must await the createClient call in Server Components/Routes
    const supabase = await createClient();

    // Fetching Aggregated HR Insights
    const { data, error } = await supabase
        .from('profiles')
        .select(`
      full_name,
      username,
      leave_requests!leave_requests_employee_id_fkey (
        status, 
        start_date, 
        end_date
      ),
      swap_requests!swap_requests_requestor_id_fkey (
        status
      )
    `) as { data: EmployeeProfile[] | null; error: any };

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json([]);
    }

    // FIX 2: Explicitly type the 'employee' and 'l' parameters
    const report = data.map((employee: EmployeeProfile) => {
        const approvedLeave = employee.leave_requests?.filter((l: LeaveRequest) => l.status === 'approved').length || 0;
        const swapCount = employee.swap_requests?.length || 0;

        return {
            name: employee.full_name || 'Unknown',
            username: employee.username || 'n/a',
            total_approved_leaves: approvedLeave,
            swap_frequency: swapCount,
            // Reliability Score: Starts at 100, drops 5 points per swap request
            reliability_score: Math.max(0, 100 - (swapCount * 5))
        };
    });

    return NextResponse.json(report);
}