import { Suspense } from 'react';


import HomeSkeleton from '@/components/HomeSkeleton';
import InboxWrapper from '@/components/employee/InboxWrapper';

export default async function InboxPage() {
    // Calling cookies() here satisfies the requirement for dynamic rendering 


    return (
        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 relative min-h-screen">
            {/* Poster Element: Massive Ghost Header */}
            <div className="absolute top-4 left-6 pointer-events-none select-none overflow-hidden">
                <h1 className="text-[15vw] font-black opacity-[0.03] leading-[0.8] tracking-tighter uppercase whitespace-nowrap">
                    INBOX
                </h1>
            </div>



            <main className="px-4 pt-12 relative z-10 max-w-2xl">
                <Suspense fallback={<HomeSkeleton />}>
                    <InboxWrapper />
                </Suspense>
            </main>

            {/* Subtle Aesthetic Grid Line */}
            {/* <div className="fixed left-6 top-0 w-[1px] h-full bg-black/[0.02] pointer-events-none" /> */}
        </div>
    );
}