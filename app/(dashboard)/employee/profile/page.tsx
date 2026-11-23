import { Suspense } from 'react';
import ProfileWrapper from '@/components/employee/ProfileWrapper';
import WorkspaceSkeleton from '@/components/WorkspaceSkeleton';

export default function Page() {
    return (
        <Suspense fallback={<WorkspaceSkeleton />}>
            <ProfileWrapper />
        </Suspense>
    );
}
