import { Suspense } from 'react';
import HomeSkeleton from '@/components/HomeSkeleton';
import NavWrapper from '@/components/employee/NavWrapper';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[#FBFBFE]">
            {/* The main content renders immediately */}
            <main className="pb-24">
                <Suspense fallback={<HomeSkeleton />}>
                    <AuthGuard>
                        {children}
                    </AuthGuard>
                </Suspense>
            </main>

            {/* The dynamic Nav (with auth check) is wrapped in Suspense */}
            <Suspense fallback={null}>
                <NavWrapper />
            </Suspense>
        </div>
    );
}

async function AuthGuard({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role === 'admin') {
        // If an admin accidentally accesses employee routes, redirect to admin dash
        redirect('/admin');
    }

    // Otherwise, as long as they are authenticated, let them through to employee
    return <>{children}</>;
}