'use client';

import { useState, type FormEvent } from 'react';
import { createNewUser } from '@/app/actions/admin';
import { useOperationsDraft } from '@/lib/store-ops/use-draft';

type Store = { id: string; name: string | null };
const control = 'mt-1 block min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base';
const submit = 'min-h-11 rounded-lg bg-[var(--store-ink)] px-4 py-2 font-medium text-[var(--store-on-solid)] disabled:opacity-60';

export default function AddEmployeeForm({ stores }: { stores: Store[] }) {
    const [created, setCreated] = useState('');
    if (!created) return <EmployeeFields stores={stores} onCreated={setCreated} />;
    return (
        <div className="space-y-4">
            <p role="status">Account created. The employee can sign in as <strong>{created}</strong> with the password you set.</p>
            <button className={submit} onClick={() => setCreated('')}>Add another employee</button>
        </div>
    );
}

function EmployeeFields({ stores, onCreated }: { stores: Store[]; onCreated: (username: string) => void }) {
    const [fields, setFields] = useState({ fullName: '', email: '', username: '', storeId: stores.length === 1 ? stores[0].id : '' });
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');
    // Keep the initial password in the input only, separate from the saved draft.
    const clearDraft = useOperationsDraft('add-employee', fields, setFields);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        setPending(true);
        setError('');
        try {
            const result = await createNewUser(data);
            if (result.username) {
                clearDraft();
                onCreated(result.username);
            } else {
                setError(result.error || 'Couldn’t create the employee account.');
            }
        } catch {
            setError('Couldn’t confirm account creation. Check your connection before retrying.');
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} aria-busy={pending} className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
            <fieldset disabled={pending} className="grid gap-4">
                <label>Full name
                    <input className={control} name="fullName" autoComplete="off" required maxLength={150} value={fields.fullName}
                        onChange={e => setFields({ ...fields, fullName: e.target.value })} />
                </label>
                <label>Store
                    <select className={control} name="storeId" required value={fields.storeId}
                        onChange={e => setFields({ ...fields, storeId: e.target.value })}>
                        <option value="" disabled>Choose a store</option>
                        {stores.map(store => <option key={store.id} value={store.id}>{store.name || store.id}</option>)}
                    </select>
                </label>
                <label>Email
                    <input className={control} type="email" name="email" autoComplete="off" autoCapitalize="none" required value={fields.email}
                        onChange={e => setFields({ ...fields, email: e.target.value })} />
                </label>
                <label>Sign-in username
                    <input className={control} name="username" autoComplete="off" autoCapitalize="none" spellCheck={false}
                        required pattern="[a-z0-9._\-]+" maxLength={64} title="Use letters, numbers, dots, underscores or hyphens."
                        value={fields.username} onChange={e => setFields({ ...fields, username: e.target.value.toLowerCase() })} />
                </label>
                <label>Initial password
                    <input className={control} type="password" name="password" autoComplete="new-password" required minLength={8} aria-describedby="password-hint" />
                    <span className="mt-1 block text-xs text-slate-500" id="password-hint">At least 8 characters. Share privately with the employee.</span>
                </label>
                {error && <p role="alert" className="text-[var(--store-negative)]">{error}</p>}
                <button type="submit" className={submit}>{pending ? 'Creating account…' : 'Create employee account'}</button>
            </fieldset>
        </form>
    );
}
