'use client';
import { useSearchParams } from 'next/navigation';
import { login } from '@/app/actions/login';
import { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

export default function LoginForm() {
    const searchParams = useSearchParams();
    const error = searchParams.get('error');
    const [isPending, setIsPending] = useState(false);

    return (
        <form
            action={async (formData) => {
                setIsPending(true);
                await login(formData);
                setIsPending(false);
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
                        className="w-full bg-neutral-50 border border-neutral-100 p-5 rounded-2xl text-xs font-bold tracking-widest outline-none transition-all focus:bg-white focus:border-black placeholder:text-neutral-300"
                    />
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 px-2 animate-in fade-in duration-500">
                    <div className="w-1 h-1 bg-red-500 rounded-full" />
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest">
                        Identity mismatch. Try again.
                    </p>
                </div>
            )}

            <button
                disabled={isPending}
                type="submit"
                className="w-full bg-black group hover:bg-neutral-800 text-white p-5 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-between"
            >
                <span className="text-[10px] font-black uppercase tracking-[0.3em] ml-2">
                    {isPending ? "Verifying..." : "Authorize Entry"}
                </span>
                {isPending ? (
                    <Loader2 className="animate-spin" size={18} strokeWidth={1.5} />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <ArrowRight size={16} strokeWidth={1.5} />
                    </div>
                )}
            </button>
        </form>
    );
}