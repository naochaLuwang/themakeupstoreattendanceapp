'use client';

import { useState } from 'react';
import { changeEmployeeRole } from './actions';

type Role = 'admin' | 'manager' | 'employee';
const labels = { admin: 'Admin', manager: 'Manager', employee: 'Employee' };

export default function EmployeeRoleEditor({ id, name, role, ownAccount }: { id: string; name: string; role: Role; ownAccount: boolean }) {
    const [draft, setDraft] = useState<{ selected: Role; expected: Role } | null>(null);
    const selected = draft?.selected ?? role;
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState('');
    if (ownAccount) return <span className="px-3 text-sm">{labels[role]}</span>;

    async function save() {
        if (pending || !draft || selected === role) return;
        setPending(true);
        setMessage('');
        try {
            const result = await changeEmployeeRole({ id, expected: draft.expected, role: selected });
            if (result.error) setMessage(result.error);
            else { setDraft(null); setMessage('Role saved.'); }
        } catch {
            setMessage('Couldn’t confirm the change. Refresh to check the current role.');
        } finally {
            setPending(false);
        }
    }
    return (
        <div className="max-w-full">
            <div className="flex flex-wrap items-center gap-2">
                <select aria-label={`Role for ${name}`} value={selected} disabled={pending}
                    onChange={event => { setDraft({ selected: event.target.value as Role, expected: role }); setMessage(''); }}
                    className="min-h-11 rounded-lg border border-slate-200 bg-white px-2 text-base">
                    {role === 'manager' && <option value="manager">Manager</option>}
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                </select>
                {selected !== role && <button type="button" disabled={pending} onClick={save} aria-label={`Save ${labels[selected]} role for ${name}`}
                    className="min-h-11 rounded-lg bg-[var(--store-ink)] px-3 text-[var(--store-on-solid)]">
                    {pending ? 'Saving…' : 'Save'}
                </button>}
            </div>
            <p role="status" className="text-sm">{message}</p>
        </div>
    );
}
