'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X } from 'lucide-react';
import { isNativeWorkspace } from '@/lib/native/experience';

interface InstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPWA() {
    const pathname = usePathname();
    const [supportsPWA, setSupportsPWA] = useState(false);
    const [promptInstall, setPromptInstall] = useState<InstallPromptEvent | null>(null);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (isNativeWorkspace()) return;
        const handler = (e: Event) => {
            e.preventDefault();
            setSupportsPWA(true);
            setPromptInstall(e as InstallPromptEvent);
        };

        window.addEventListener("beforeinstallprompt", handler);

        // Don't show if already in standalone mode
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setSupportsPWA(false);
        }

        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstall = async () => {
        if (!promptInstall) return;
        promptInstall.prompt();
        const { outcome } = await promptInstall.userChoice;
        if (outcome === "accepted") setSupportsPWA(false);
    };

    if (pathname.startsWith('/attendance-station') || !supportsPWA || !isVisible) return null;

    return (
        <div data-native-install className="fixed bottom-6 left-4 right-4 md:bottom-12 md:left-auto md:right-12 md:w-80 z-[100] animate-in slide-in-from-bottom-5 duration-700">
            <div className="bg-black text-white p-5 rounded-[2rem] shadow-2xl flex flex-col gap-4 border border-white/10">
                <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                        <div className="bg-white/10 p-2 rounded-xl h-fit">
                            <Download size={18} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1">Mobile App Available</p>
                            <p className="text-[11px] text-neutral-400 leading-relaxed font-medium">
                                Add the workspace to your home screen for faster access.
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setIsVisible(false)} className="opacity-40 hover:opacity-100 transition-opacity">
                        <X size={16} />
                    </button>
                </div>

                <button
                    onClick={handleInstall}
                    className="w-full bg-white text-black py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] active:scale-[0.98] transition-all"
                >
                    Install Now
                </button>
            </div>
        </div>
    );
}
