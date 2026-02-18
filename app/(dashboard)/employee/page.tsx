import { Suspense } from 'react';
import EmployeeDashboardContent from '@/components/employee/EmployeeDashboardContent';
import HomeSkeleton from '@/components/HomeSkeleton';

export default function EmployeePage() {
    return (
        <div className="px-6 pt-12 space-y-6">
            {/* 1. Static Header: Loads instantly */}
            {/* <header>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Staff Portal</p>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Dashboard</h1>
            </header> */}

            {/* 2. Dynamic Content: Wrapped in Suspense to prevent blocking */}
            <Suspense fallback={<HomeSkeleton />}>
                <EmployeeDashboardContent />
            </Suspense>
        </div>
    );
}