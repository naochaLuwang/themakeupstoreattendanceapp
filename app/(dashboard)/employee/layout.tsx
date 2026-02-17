import { Suspense } from 'react';
import HomeSkeleton from '@/components/HomeSkeleton';
import NavWrapper from '@/components/employee/NavWrapper';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#FBFBFE]">
            {/* The main content renders immediately */}
            <main className="pb-24">
                {children}
            </main>

            {/* The dynamic Nav (with auth check) is wrapped in Suspense */}
            <Suspense fallback={null}>
                <NavWrapper />
            </Suspense>
        </div>
    );
}