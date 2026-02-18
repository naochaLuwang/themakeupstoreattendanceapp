import { Suspense } from 'react';
import LeaveWrapper from '@/components/employee/LeaveWrapper';
import HomeSkeleton from '@/components/HomeSkeleton';

export default function LeavePage() {
    return (
        <div className="relative min-h-screen bg-[#FAFAFA] animate-in fade-in duration-700">
            {/* Poster Element: Massive Ghost Branding */}
            <div className="absolute top-4 left-6 pointer-events-none select-none overflow-hidden">
                <h1 className="text-[15vw] font-black opacity-[0.03] leading-[0.8] tracking-tighter uppercase whitespace-nowrap">
                    ABSENCE
                </h1>
            </div>

            {/* Static Header */}
            <header className="p-8 pt-16 relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-[2px] bg-indigo-600" />
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em]">
                        Time_Off_Portal
                    </p>
                </div>
                <h1 className="text-5xl font-black text-slate-900 tracking-tighter leading-none">
                    Leave<br />Requests.
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">
                    Schedule & Absence Management
                </p>
            </header>

            {/* Dynamic Content Boundary */}
            <main className="px-4 relative z-10">
                <Suspense fallback={<HomeSkeleton />}>
                    <LeaveWrapper />
                </Suspense>
            </main>

            {/* Aesthetic Grid Line - Positioned to align with the text edge */}
            <div className="fixed left-8 top-0 w-[1px] h-full bg-black/[0.03] pointer-events-none" />
        </div>
    );
}