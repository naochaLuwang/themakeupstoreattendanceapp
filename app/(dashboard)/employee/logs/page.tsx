import { Suspense } from 'react';
import LogsWrapper from '@/components/employee/LogsWrapper';
import WorkspaceSkeleton from '@/components/WorkspaceSkeleton';

export default function Page() {
    return (
        <Suspense fallback={<WorkspaceSkeleton />}>
            <LogsWrapper />
        </Suspense>
    );
}
