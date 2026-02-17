// app/(dashboard)/admin/layout.tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import AdminNav from '@/components/admin/AdminNav';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex min-h-screen bg-slate-50 flex-col lg:flex-row">
            {/* Sidebar remains visible while content loads */}
            <AdminNav />

            <main className="flex-1 p-4 md:p-10 overflow-y-auto max-h-screen">
                <Suspense fallback={
                    <div className="flex flex-col gap-6 animate-pulse">
                        <div className="h-20 w-1/3 bg-slate-200 rounded-2xl" />
                        <div className="h-[500px] w-full bg-slate-200 rounded-[3rem]" />
                    </div>
                }>
                    <AuthGuard>
                        {children}
                    </AuthGuard>
                </Suspense>
            </main>
        </div>
    );
}

async function AuthGuard({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    return <>{children}</>;
}