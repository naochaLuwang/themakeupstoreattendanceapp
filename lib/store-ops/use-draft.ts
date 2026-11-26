'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function useOperationsDraft<T extends object>(name: string, value: T, restore: (draft: T) => void) {
    const [key, setKey] = useState<string | null>(null);
    const restoreRef = useRef(restore);
    const initial = useRef(value);
    const cleared = useRef(false);
    restoreRef.current = restore;
    useEffect(() => {
        let active = true;
        void createClient().auth.getUser().then(({ data: { user } }) => {
            if (!active || !user) return;
            const id = `store-ops:draft:v1:${user.id}:${name}`;
            try {
                const raw = localStorage.getItem(id);
                if (raw && raw.length < 1_000_000) {
                    const saved = JSON.parse(raw) as { at?: number; value?: T };
                    if (saved.at && Date.now() - saved.at < 7 * 86400_000 && saved.value && typeof saved.value === 'object' &&
                        Object.keys(initial.current).every(field => field in saved.value!)) restoreRef.current(saved.value);
                }
            } catch { /* Optional local drafts never block submission. */ }
            setKey(id);
        });
        return () => { active = false; };
    }, [name]);
    useEffect(() => {
        if (!key || cleared.current) return;
        const timer = window.setTimeout(() => { try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), value })); } catch { /* Storage may be unavailable. */ } }, 350);
        return () => window.clearTimeout(timer);
    }, [key, value]);
    return () => { cleared.current = true; try { if (key) localStorage.removeItem(key); } catch { /* Optional draft. */ } };
}
