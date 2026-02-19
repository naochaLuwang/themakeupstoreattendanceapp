'use client';
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

export default function InstallPWA() {
    const [supportsPWA, setSupportsPWA] = useState(false);
    const [promptInstall, setPromptInstall] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setSupportsPWA(true);
            setPromptInstall(e);
        };

        window.addEventListener("beforeinstallprompt", handler);

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setSupportsPWA(false);
        }

        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const onClick = async (e: any) => {
        e.preventDefault();
        if (!promptInstall) return;

        promptInstall.prompt();
        const { outcome } = await promptInstall.userChoice;

        if (outcome === "accepted") {
            setSupportsPWA(false);
        }
    };

    if (!supportsPWA || !isVisible) return null;

    return (
        <div className="fixed bottom-24 left-4 right-4 z-[60] animate-in slide-in-from-bottom-10 duration-500">
            <div className="bg-slate-900 text-white p-4 rounded-[2rem] shadow-2xl flex items-center justify-between border border-white/10">
                <div className="flex items-center gap-3">
                    <div className="bg-white/10 p-2 rounded-xl">
                        <Download size={20} className="text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">App Available</p>
                        <p className="text-xs font-bold">Install for better experience</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onClick}
                        className="bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all active:scale-95"
                    >
                        Install
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="p-2 opacity-50 hover:opacity-100"
                    >
                        <X size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}