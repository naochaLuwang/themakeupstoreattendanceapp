import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import BulkScheduler from '@/components/admin/BulkScheduler';
import PresetManager from '@/components/admin/PresetManager';
import HomeSkeleton from '@/components/HomeSkeleton';

export default async function AdminSchedulePage() {
    const supabase = await createClient();
    const { data: employees } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'employee');

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
            {/* 1. Integrated Header */}
            <header className="px-4 md:px-0">
                <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Shift Planner</h1>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">
                    Bulk Schedule Management & Presets
                </p>
            </header>

            {/* 2. Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* 🎨 Left/Main Column: The Painter (8 Cols) */}
                <div className="lg:col-span-8 space-y-6 order-2 lg:order-1">
                    <Suspense fallback={<HomeSkeleton />}>
                        <BulkScheduler employees={employees || []} />
                    </Suspense>
                </div>

                {/* 🛠️ Right Column: The Library (4 Cols) */}
                <aside className="lg:col-span-4 space-y-6 order-1 lg:order-2 lg:sticky lg:top-8">
                    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50">
                        <div className="mb-6">
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Shift Library</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage reusable shift blocks</p>
                        </div>
                        <PresetManager />
                    </div>

                    {/* Quick Tip Card */}
                    <div className="bg-slate-900 rounded-[2rem] p-6 text-white overflow-hidden relative group">
                        <div className="relative z-10">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Pro Tip</p>
                            <p className="text-xs font-medium opacity-80 leading-relaxed">
                                Select a "Brush" from your library, then tap dates on the calendar to instantly assign that shift.
                            </p>
                        </div>
                        <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
                            <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
}