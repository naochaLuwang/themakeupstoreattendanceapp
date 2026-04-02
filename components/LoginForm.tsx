'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryError = searchParams.get('error');

    const [isPending, setIsPending] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    // Haptic helper for mobile "click" feel
    const triggerHaptic = () => {
        if (typeof window !== 'undefined' && window.navigator.vibrate) {
            window.navigator.vibrate(15);
        }
    };

    const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        triggerHaptic();
        setIsPending(true);
        setLocalError(null);

        const formData = new FormData(e.currentTarget);

        try {
            // Using a stable API route instead of a hashed Server Action
            // This is immune to the "UnrecognizedActionError" in production
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // If login works, we use router.push instead of redirect from server
                // This ensures a clean client-side navigation
                router.push('/');
                router.refresh(); // Refresh to ensure session is recognized
            } else {
                setLocalError(result.error || 'Identity mismatch. Try again.');
                setIsPending(false);
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setLocalError('Network error. Please check your connection.');
            setIsPending(false);
        }
    };

    const errorMessage = localError || queryError;

    return (
        <form
            onSubmit={handleLoginSubmit}
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

            {errorMessage && (
                <div className="flex items-center gap-2 px-2 animate-in slide-in-from-top-1 duration-300">
                    <div className="w-1 h-1 bg-red-500 rounded-full" />
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                        {errorMessage}
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