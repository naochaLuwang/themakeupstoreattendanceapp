'use client';
import { useEffect, useId, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function StorePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
    const id = useId();
    const [stores, setStores] = useState<{ id: string; name: string | null }[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        let active = true;
        void (async () => {
            const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Sign in to choose a store.');
            const { data: profile } = await supabase.from('profiles').select('role,store_id').eq('id', user.id).single();
            let query = supabase.from('stores').select('id,name').order('name');
            if (profile?.role !== 'admin') query = query.eq('id', profile?.store_id || '');
            const { data, error: resultError } = await query;
            if (resultError) throw new Error('Stores could not be loaded.');
            if (active) { setStores(data || []); setLoading(false); }
        })().catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : 'Store unavailable.'); setLoading(false); } });
        return () => { active = false; };
    }, []);
    useEffect(() => { if (!value && stores.length === 1) onChange(stores[0].id); }, [stores, value, onChange]);
    return <div><label htmlFor={id} className="text-sm font-medium">Store</label><select id={id} required value={value} onChange={event => onChange(event.target.value)} disabled={loading} className="mt-1 w-full rounded-lg border bg-white p-3 text-slate-900 dark:bg-slate-900 dark:text-slate-100"><option value="">{loading ? 'Loading stores…' : 'Choose a store'}</option>{stores.map(store => <option key={store.id} value={store.id}>{store.name || 'Store'}</option>)}</select>{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}</div>;
}
