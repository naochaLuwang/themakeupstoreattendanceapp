import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getStaffAccess } from '@/lib/admin-client';
import EmployeeRoleEditor from './EmployeeRoleEditor';

const pageSize = 30;
export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
    const access = await getStaffAccess();
    if (!access) redirect('/login');
    if (access.profile?.role !== 'admin') redirect('/');

    const params = await searchParams;
    const term = typeof params.q === 'string' ? params.q.trim().slice(0, 150) : '';
    const page = Math.max(1, Math.min(100000, Math.floor(Number(params.page) || 1)));
    const pageHref = (number: number) => '/admin/employees?' + new URLSearchParams({ q: term, page: String(number) });

    let query = access.client.from('profiles').select('id,full_name,username,email,role,store_id')
        .order('full_name').order('id');
    if (access.profile.store_id) query = query.eq('store_id', access.profile.store_id);
    if (term) query = query.ilike('full_name', '%' + term.replace(/[\\%_]/g, '\\$&') + '%');
    const start = (page - 1) * pageSize;
    const { data, error } = await query.range(start, start + pageSize);
    const people = (data ?? []).slice(0, pageSize);
    const storeIds = [...new Set(people.flatMap(p => p.store_id ? [p.store_id] : []))];
    const stores = storeIds.length ? await access.client.from('stores').select('id,name').in('id', storeIds) : null;
    const names = new Map(stores?.data?.map(store => [store.id, store.name]));

    return (
        <section className="max-w-3xl space-y-5">
            <header className="flex items-center justify-between gap-3">
                <h1>Employees</h1>
                <Link href="/admin/employees/new" className="rounded-lg bg-[var(--store-ink)] px-4 py-3 text-sm font-medium text-[var(--store-on-solid)]">Add employee</Link>
            </header>
            <form action="/admin/employees" className="flex gap-2">
                <input name="q" type="search" aria-label="Search by full name" placeholder="Search by full name"
                    defaultValue={term} maxLength={150} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base" />
                <button className="rounded-lg border border-slate-200 px-4 py-2">Search</button>
            </form>
            {error || stores?.error ? <p role="alert">Couldn’t load the employee directory. Refresh to try again.</p>
                : people.length === 0 ? <p>{term ? 'No employees match this name.' : 'No employees on this page.'}</p>
                : <ul className="divide-y divide-[var(--store-border)] rounded-xl border border-slate-200 bg-white">
                    {people.map(person => {
                        const name = person.full_name || person.username || person.email || 'Unnamed employee';
                        return <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                            <div className="min-w-0 flex-1">
                                <p className="break-words font-medium">{name}{person.id === access.userId && ' (you)'}</p>
                                <p className="break-words text-sm text-[var(--store-muted)]">
                                    {[person.username || person.email, person.store_id ? names.get(person.store_id) || 'Unnamed store' : 'No assigned store'].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                            <EmployeeRoleEditor id={person.id} name={name} role={person.role} ownAccount={person.id === access.userId} />
                        </li>;
                    })}
                </ul>}
            <nav aria-label="Employee directory pages" className="flex gap-4">
                {page > 1 && <Link className="underline" href={pageHref(page - 1)}>Previous</Link>}
                {data && data.length > pageSize && <Link className="underline" href={pageHref(page + 1)}>Next</Link>}
            </nav>
        </section>
    );
}
