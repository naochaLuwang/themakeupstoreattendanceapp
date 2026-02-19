'use client';
import { useSearchParams } from 'next/navigation';
import { login } from '@/app/actions/login';
import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function LoginForm() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error');
    const [isPending, setIsPending] = useState(false);

    // Haptic helper for mobile "click" feel
    const triggerHaptic = () => {
        if (typeof window !== 'undefined' && window.navigator.vibrate) {
            window.navigator.vibrate(15);
        }
    };

    return (
        <form
            action={async (formData) => {
                triggerHaptic();
                setIsPending(true);

                // We don't setIsPending(false) here on success 
                // because the redirect will handle the page change.
                // We only reset if there is an error (though redirects usually stop execution).
                try {
                    await login(formData);
                } catch (e) {
                    // If login action doesn't redirect (e.g., handles errors internally)
                    setIsPending(false);
                }
            }}
            className="space-y-8"
        >
            <div className="space-y-6">
                {/* Username */}
                <div className="relative group">
                    <span className="absolute -left-4 top-1/2 -translate-y-1/2 text-[8px] font-bold text-neutral-200 group-focus-within:text-black transition-colors hidden md:block">01</span>
                    <input
                        name="username"
                        type="text"
                        placeholder="STAFF_ID"
                        required
                        autoComplete="username"
                        className="w-full bg-neutral-50 border border-neutral-100 p-5 rounded-2xl text-xs font-bold tracking-widest outline-none transition-all focus:bg-white focus:border-black placeholder:text-neutral-300 uppercase"
                    />
                </div>

                {/* Password */}
                <div className="relative group">
                    <span className="absolute -left-4 top-1/2 -translate-y-1/2 text-[8px] font-bold text-neutral-200 group-focus-within:text-black transition-colors hidden md:block">02</span>
                    <input
                        name="password"
                        type="password"
                        placeholder="PASSCODE"
                        required
                        autoComplete="current-password"
                        className="w-full bg-neutral-50 border border-neutral-100 p-5 rounded-2xl text-xs font-bold tracking-widest outline-none transition-all focus:bg-white focus:border-black placeholder:text-neutral-300"
                    />
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 px-2 animate-in slide-in-from-top-1 duration-300">
                    <div className="w-1 h-1 bg-red-500 rounded-full" />
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                        Identity mismatch. Try again.
                    </p>
                </div>
            )}

            <button
                disabled={isPending}
                type="submit"
                className="w-full bg-black group hover:bg-neutral-800 text-white p-5 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-between"
            >
                <span className="text-[10px] font-black uppercase tracking-[0.3em] ml-2">
                    {isPending ? "Validating Credentials..." : "Authorize Entry"}
                </span>

                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                    {isPending ? (
                        <Loader2 className="animate-spin text-white" size={16} strokeWidth={2} />
                    ) : (
                        <ArrowRight size={16} strokeWidth={1.5} />
                    )}
                </div>
            </button>
        </form>
    );
}