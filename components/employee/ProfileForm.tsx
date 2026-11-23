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
        else alert("Name updated.");
        setLoading(false);
    }

    return (
        <form onSubmit={handleUpdate} className="pt-2 pb-6 space-y-4">
            <div className="space-y-2">
                <label htmlFor="profile-full-name" className="text-sm text-slate-500">Full name</label>
                <input
                    id="profile-full-name" autoComplete="name" disabled={loading} type="text" value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-6 py-4 text-sm font-medium focus:ring-1 focus:ring-black outline-none transition-colors"
                />
            </div>
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-sm font-medium text-white">
                {loading && <Loader2 size={16} className="animate-spin" />} Save name
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
        if (password.length < 6) return alert("Use at least 6 characters for your password.");
        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) alert(error.message);
        else {
            alert("Password updated.");
            setPassword('');
        }
        setLoading(false);
    }

    return (
        <form onSubmit={handleUpdate} className="pt-2 pb-6 space-y-4">
            <div className="space-y-2">
                <label htmlFor="profile-new-password" className="text-sm text-slate-500">New password</label>
                <input
                    id="profile-new-password" autoComplete="new-password" minLength={6} required disabled={loading} type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border border-slate-200 rounded-xl px-6 py-4 text-sm font-medium focus:ring-1 focus:ring-black outline-none transition-colors"
                />
            </div>
            <button disabled={loading} className="w-full bg-black text-white text-sm font-medium tracking-normal py-4 rounded-xl hover:opacity-90 transition-colors flex items-center justify-center gap-2">
                {loading && <Loader2 size={14} className="animate-spin" />} Update password
            </button>
        </form>
    );
}
