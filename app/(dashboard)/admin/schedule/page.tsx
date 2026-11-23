import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import BulkScheduler from '@/components/admin/BulkScheduler';
import PresetManager from '@/components/admin/PresetManager';
import HomeSkeleton from '@/components/HomeSkeleton';

export default async function AdminSchedulePage() {
    const supabase = await createClient();
    const { data: rawEmployees } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'employee');

    const employees = (rawEmployees || []).map(e => ({
        id: e.id,
        full_name: e.full_name || 'Unknown'
    }));

    return (
        <div className="max-w-[1600px] mx-auto space-y-8">
            {/* 1. Integrated Header */}
            <header className="px-4 md:px-0">
                <h1 className="text-3xl font-medium text-slate-900 tracking-normal">Shift planner</h1>
                <p className="text-sm font-medium text-slate-500 tracking-normal mt-2">
                    Plan staff shifts and manage reusable shift presets
                </p>
            </header>

            {/* 2. Main Dashboard Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

                {/* 🎨 Left/Main Column: The Painter (8 Cols) */}
                <div className="xl:col-span-8 space-y-6 order-2 xl:order-1">
                    <Suspense fallback={<HomeSkeleton />}>
                        <BulkScheduler employees={employees || []} />
                    </Suspense>
                </div>

                {/* 🛠️ Right Column: The Library (4 Cols) */}
                <aside className="xl:col-span-4 space-y-6 order-1 xl:order-2 xl:sticky lg:top-8">
                    <div className="bg-white border border-slate-100 rounded-xl p-8">
                        <div className="mb-6">
                            <h3 className="text-xl font-medium text-slate-900 tracking-normal">Shift library</h3>
                            <p className="text-sm font-medium text-slate-500 tracking-normal mt-1">Manage reusable shift blocks</p>
                        </div>
                        <PresetManager />
                    </div>

                    {/* Quick Tip Card */}
                    <div className="bg-slate-100 border border-slate-200 rounded-xl p-6 text-slate-700 overflow-hidden relative group">
                        <div className="relative z-10">
                            <p className="text-sm font-medium tracking-normal text-slate-900 mb-2">Assign a shift</p>
                            <p className="text-xs font-medium  leading-relaxed">
                                Choose a shift preset, then select dates on the calendar. Publish the schedule when you’re ready.
                            </p>
                        </div>

                    </div>
                </aside>
            </div>
        </div>
    );
}
