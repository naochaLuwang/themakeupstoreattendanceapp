import { Suspense } from 'react';
import EmployeeDashboardContent from '@/components/employee/EmployeeDashboardContent';
import WorkspaceSkeleton from '@/components/WorkspaceSkeleton';

export default function Page() {
    return (
        <Suspense fallback={<WorkspaceSkeleton />}>
            <EmployeeDashboardContent />
        </Suspense>
    );
}
