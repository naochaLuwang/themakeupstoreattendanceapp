import { Suspense } from 'react';
import WorkspaceSkeleton from '@/components/WorkspaceSkeleton';
import '@/components/workspace.css';
import './employee.css';
import './employee-design.css';
import NavWrapper from '@/components/employee/NavWrapper';
import ThemeToggle from '@/components/ThemeToggle';
import AppBrand from '@/components/AppBrand';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import NotificationFeedProvider from '@/components/notifications/NotificationFeedProvider';
import NotificationPanel from '@/components/store-ops/notifications/NotificationPanel';

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
    return <Suspense fallback={<WorkspaceSkeleton />}><EmployeeWorkspace>{children}</EmployeeWorkspace></Suspense>;
}

async function EmployeeWorkspace({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role === 'admin') redirect('/admin');

    return (
        <NotificationFeedProvider key={user.id} userId={user.id}>
        <div className="employee-shell store-ui">
            <a href="#employee-content" className="employee-skip-link">Skip to content</a>
            <Suspense fallback={null}><NavWrapper /></Suspense>
            <div id="employee-content" tabIndex={-1} className="employee-content">
                <div className="employee-brand-mobile">
                    <div className="employee-mobile-brand">
                        <AppBrand subtitle="Staff workspace" />
                    </div>
                    <div className="employee-header-actions"><NotificationPanel userId={user.id} /><ThemeToggle /></div>
                </div>
                <div className="employee-content-inner">
                    <Suspense fallback={<WorkspaceSkeleton />}>
                        {children}
                    </Suspense>
                </div>
            </div>
        </div>
        </NotificationFeedProvider>
    );
}
