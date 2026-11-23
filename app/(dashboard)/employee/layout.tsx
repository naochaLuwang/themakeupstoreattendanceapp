import { Suspense } from 'react';
import WorkspaceSkeleton from '@/components/WorkspaceSkeleton';
import '@/components/workspace.css';
import './employee.css';
import NavWrapper from '@/components/employee/NavWrapper';
import ThemeToggle from '@/components/ThemeToggle';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="employee-shell store-ui">
            <a href="#employee-content" className="employee-skip-link">Skip to content</a>
            <Suspense fallback={null}><NavWrapper /></Suspense>
            <div id="employee-content" tabIndex={-1} className="employee-content">
                <div className="employee-brand-mobile">
                    <div>
                        <p className="employee-wordmark">The Makeup Store</p>
                        <p className="employee-brand-location">Wangkhei · Staff workspace</p>
                    </div>
                    <ThemeToggle />
                </div>
                <div className="employee-content-inner">
                    <Suspense fallback={<WorkspaceSkeleton />}>
                        <AuthGuard>{children}</AuthGuard>
                    </Suspense>
                </div>
            </div>
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
