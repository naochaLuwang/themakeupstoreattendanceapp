'use client';
import { useEffect, useRef } from 'react';
import type { FieldValues, UseFormReturn, DefaultValues } from 'react-hook-form';
import { createClient } from '@/lib/supabase/client';

export function useFormDraft<T extends FieldValues>(form: UseFormReturn<T>, name: string) {
    const key = useRef<string | null>(null);
    const completed = useRef(false);
    useEffect(() => {
        let active = true;
        let stop: (() => void) | undefined;
        void createClient().auth.getUser().then(({ data: { user } }) => {
            if (!active || !user) return;
            key.current = `store-ops:draft:v1:${user.id}:${name}`;
            try {
                const raw = localStorage.getItem(key.current);
                if (raw) {
                    const saved: { at: number; value: DefaultValues<T> } = JSON.parse(raw);
                    if (Date.now() - saved.at < 7 * 86400_000 && saved.value && typeof saved.value === 'object') form.reset(saved.value);
                }
            } catch { /* A draft must never prevent a form from opening. */ }
            const subscription = form.watch(value => {
                if (!key.current || completed.current) return;
                try { localStorage.setItem(key.current, JSON.stringify({ at: Date.now(), value })); } catch { /* Storage may be disabled or full. */ }
            });
            stop = subscription.unsubscribe;
        });
        return () => { active = false; stop?.(); };
    }, [form, name]);
    return () => {
        completed.current = true;
        try { if (key.current) localStorage.removeItem(key.current); } catch { /* Optional local draft. */ }
    };
}
