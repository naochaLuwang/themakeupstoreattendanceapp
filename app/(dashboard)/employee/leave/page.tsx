import { Suspense } from 'react';
import LeaveWrapper from '@/components/employee/LeaveWrapper';
import WorkspaceSkeleton from '@/components/WorkspaceSkeleton';

export default function Page() {
    return (
        <Suspense fallback={<WorkspaceSkeleton />}>
            <LeaveWrapper />
        </Suspense>
    );
}
