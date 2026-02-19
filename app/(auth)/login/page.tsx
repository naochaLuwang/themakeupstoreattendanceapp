// 'use client';
// import { Suspense } from 'react';
// import LoginForm from '@/components/LoginForm';

// export default function LoginPage() {
//     return (
//         <div className="min-h-screen bg-[#FBFBFB] flex items-center justify-center p-6 font-sans relative overflow-hidden">

//             {/* Poster Element: Massive Vertical Title */}
//             <div className="absolute left-4 top-1/2 -translate-y-1/2 hidden lg:block pointer-events-none">
//                 <h1 className="text-[12vh] font-black tracking-tighter text-black/[0.03] rotate-[-90deg] origin-center uppercase">
//                     Noir Atelier
//                 </h1>
//             </div>

//             {/* Poster Element: Grid Info Bar */}
//             <div className="absolute top-0 left-0 w-full p-8 hidden md:flex justify-between items-start border-b border-black/[0.05]">
//                 <div className="space-y-1">
//                     <p className="text-[10px] font-black uppercase tracking-[0.3em]">System_Status</p>
//                     <div className="flex items-center gap-2">
//                         <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
//                         <span className="text-[9px] font-medium text-neutral-400 tracking-widest uppercase">Encryption_Active</span>
//                     </div>
//                 </div>
//                 <div className="text-right">
//                     <p className="text-[10px] font-black uppercase tracking-[0.3em]">Terminal_Identity</p>
//                     <p className="text-[9px] font-medium text-neutral-400 tracking-widest uppercase">Main_Floor_01</p>
//                 </div>
//             </div>

//             {/* The Main Login Card (Traditional Component) */}
//             <div className="w-full max-w-[420px] bg-white border border-neutral-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] rounded-[2.5rem] p-10 md:p-14 relative z-10">
//                 <header className="mb-12">
//                     <div className="w-10 h-1 bg-black mb-6" /> {/* Minimalist Accent Line */}
//                     <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Login</h2>
//                     <p className="text-xs text-neutral-400 mt-2 tracking-wide font-medium">
//                         Access the Noir Atelier Staff Dashboard.
//                     </p>
//                 </header>

//                 <Suspense fallback={<div className="space-y-6 animate-pulse">
//                     <div className="h-14 bg-neutral-50 rounded-2xl w-full" />
//                     <div className="h-14 bg-neutral-50 rounded-2xl w-full" />
//                 </div>}>
//                     <LoginForm />
//                 </Suspense>
//             </div>

//             {/* Bottom Poster Footer */}
//             <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end opacity-20 pointer-events-none">
//                 <span className="text-[8px] font-black tracking-[0.5em] uppercase leading-none">Management_OS</span>
//                 <span className="text-[8px] font-black tracking-[0.5em] uppercase leading-none">v.2.6.0</span>
//             </div>
//         </div>
//     );
// }
'use client';
import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';
import InstallPWA from '@/components/InstallPWA';

export default function LoginPage() {
    return (
        <div className="min-h-[100dvh] bg-[#FAFAFA] flex items-center justify-center p-4 sm:p-8 font-sans relative overflow-hidden text-black">

            {/* --- THE POSTER BACKDROP (Responsive Layering) --- */}

            {/* Top Left: Massive Ghost Branding - Scaled for Mobile */}
            <div className="absolute top-10 left-6 md:top-12 md:left-12 pointer-events-none select-none z-0">
                <h1 className="text-[15vw] md:text-[12vw] font-black opacity-[0.09] leading-[0.75] tracking-tighter uppercase whitespace-nowrap">
                    THE MAKEUP<br />STORE
                </h1>
                <div className="mt-4 md:mt-8">
                    <p className="text-[8px] md:text-[10px] font-black tracking-[0.4em] md:tracking-[0.5em] uppercase leading-none opacity-60">
                        Attendance Portal
                    </p>
                    <div className="w-6 md:w-8 h-[1.5px] md:h-[2px] bg-black mt-2 md:mt-3" />
                </div>
            </div>

            {/* Top Right: Digital Counter - Hidden on very small screens to avoid clutter */}
            <div className="absolute top-6 right-6 md:top-12 md:right-12 text-right pointer-events-none font-mono hidden xs:block">
                <p className="text-[8px] md:text-[10px] font-bold tracking-widest text-black/20 uppercase">
                    Ref: 2026_SYS_01
                </p>
            </div>

            {/* Bottom Left: Dept Metadata - Tucked away */}
            <div className="absolute bottom-6 left-6 md:bottom-12 md:left-12 pointer-events-none">
                <p className="text-[8px] md:text-[9px] font-black tracking-[0.3em] uppercase opacity-30 leading-relaxed">
                    Personnel Management<br />
                    Floor_Ops_Main
                </p>
            </div>

            {/* Bottom Right: Logo Mark */}
            <div className="absolute bottom-6 right-6 md:bottom-12 md:right-12 text-right pointer-events-none">
                <div className="inline-block border-[1.5px] border-black px-1.5 py-0.5 mb-1 md:mb-2">
                    <span className="text-[8px] md:text-[10px] font-black tracking-[0.1em] uppercase italic">TMS</span>
                </div>
                <p className="text-[8px] md:text-[9px] font-black tracking-[0.2em] uppercase opacity-40">
                    Secure_Term
                </p>
            </div>

            {/* --- CENTRAL LOGIN INTERFACE --- */}

            <div className="w-full max-w-[420px] bg-white border border-neutral-100 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.08)] rounded-[2.5rem] md:rounded-[3.5rem] p-8 md:p-16 relative z-10 transition-all">
                <header className="mb-10 md:mb-14">
                    <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] md:text-[10px] font-bold tracking-[0.4em] uppercase text-neutral-400">System Ready</span>
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-neutral-900 leading-[0.85]">
                        Clock<br />In.
                    </h2>
                </header>

                <Suspense fallback={
                    <div className="space-y-4 md:space-y-6 animate-pulse">
                        <div className="h-14 md:h-16 bg-neutral-50 rounded-2xl md:rounded-3xl w-full" />
                        <div className="h-14 md:h-16 bg-neutral-50 rounded-2xl md:rounded-3xl w-full" />
                    </div>
                }>
                    <LoginForm />
                </Suspense>
            </div>

            <InstallPWA />
            {/* Background Grid Accent - Reduced columns for mobile visibility */}
            <div className="absolute inset-0 grid grid-cols-4 md:grid-cols-6 pointer-events-none opacity-[0.01]">
                <div className="border-r border-black h-full" />
                <div className="border-r border-black h-full" />
                <div className="border-r border-black h-full" />
                <div className="border-r border-black h-full hidden md:block" />
                <div className="border-r border-black h-full hidden md:block" />
            </div>
        </div>
    );
}