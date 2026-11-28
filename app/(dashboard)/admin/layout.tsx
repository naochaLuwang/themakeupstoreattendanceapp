// app/(dashboard)/admin/layout.tsx
import { getStaffAccess } from '@/lib/admin-client';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import AdminNav from '@/components/admin/AdminNav';
import AdminPageSkeleton from '@/components/admin/AdminPageSkeleton';
import AppBrand from '@/components/AppBrand';
import '@/components/workspace.css';
import './admin.css';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const access = await getStaffAccess();
    if (!access) redirect('/login');
    const role = access.profile?.role;
    if (role !== 'admin' && role !== 'manager') redirect('/employee');

    return (
        <div className="admin-shell store-ui">
            <a href="#admin-content" className="admin-skip-link">Skip to content</a>
            {/* Sidebar remains visible while content loads */}
            <AdminNav canManageEmployees={role === 'admin'} />

            <div id="admin-content" tabIndex={-1} className="admin-content">
                <div className="admin-content-inner">
                    <div className="admin-brand-mobile"><AppBrand subtitle="Administration" /></div>
                    <Suspense fallback={<AdminPageSkeleton />}>
                        {children}
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
