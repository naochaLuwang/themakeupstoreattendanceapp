// app/(dashboard)/admin/layout.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import AdminPageSkeleton from '@/components/admin/AdminPageSkeleton';
import '@/components/workspace.css';
import './admin.css';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="admin-shell store-ui">
            <a href="#admin-content" className="admin-skip-link">Skip to content</a>
            {/* Sidebar remains visible while content loads */}
            <AdminNav />

            <div id="admin-content" tabIndex={-1} className="admin-content">
                <div className="admin-content-inner">
                    <Suspense fallback={<AdminPageSkeleton />}>
                        <AuthGuard>
                            {children}
                        </AuthGuard>
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

    if (profile?.role !== 'admin' && profile?.role !== 'manager') {
        redirect('/employee');
    }

    return <>{children}</>;
}
