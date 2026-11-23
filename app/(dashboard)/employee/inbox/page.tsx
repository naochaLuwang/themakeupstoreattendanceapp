import { Suspense } from 'react';
import InboxWrapper from '@/components/employee/InboxWrapper';
import WorkspaceSkeleton from '@/components/WorkspaceSkeleton';

export default function Page() {
    return (
        <Suspense fallback={<WorkspaceSkeleton />}>
            <InboxWrapper />
        </Suspense>
    );
}
