'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';

export function PersonalDataForm({ initialName, userId }: { initialName: string, userId: string }) {
    const [name, setName] = useState(initialName);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    async function handleUpdate(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', userId);
        if (error) alert(error.message);
        else alert("Personnel record synced.");
        setLoading(false);
    }

    return (
        <form onSubmit={handleUpdate} className="pt-2 pb-6 space-y-4">
            <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-black/40 ml-4">Legal_Full_Name</label>
                <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 text-xs font-bold focus:ring-1 focus:ring-black outline-none transition-all"
                />
            </div>
            <button disabled={loading} className="w-full bg-black text-white text-[10px] font-black uppercase tracking-widest py-4 rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                {loading && <Loader2 size={14} className="animate-spin" />} Sync Record
            </button>
        </form>
    );
}

export function SecurityForm() {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    async function handleUpdate(e: React.FormEvent) {
        e.preventDefault();
        if (password.length < 6) return alert("Security Error: Minimum 6 characters required.");
        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) alert(error.message);
        else {
            alert("Security Protocol: Password Updated.");
            setPassword('');
        }
        setLoading(false);
    }

    return (
        <form onSubmit={handleUpdate} className="pt-2 pb-6 space-y-4">
            <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-black/40 ml-4">New Password</label>
                <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-neutral-50 border-none rounded-2xl px-6 py-4 text-xs font-bold focus:ring-1 focus:ring-black outline-none transition-all"
                />
            </div>
            <button disabled={loading} className="w-full bg-black text-white text-[10px] font-black uppercase tracking-widest py-4 rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                {loading && <Loader2 size={14} className="animate-spin" />} Update Credentials
            </button>
        </form>
    );
}