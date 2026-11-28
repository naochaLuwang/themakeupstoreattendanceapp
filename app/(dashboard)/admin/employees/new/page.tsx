import { redirect } from 'next/navigation';
import { getStaffAccess } from '@/lib/admin-client';
import AddEmployeeForm from './AddEmployeeForm';

export default async function NewEmployeePage() {
    const access = await getStaffAccess();
    if (!access) redirect('/login');
    if (access.profile?.role !== 'admin') redirect('/');

    let query = access.client.from('stores').select('id,name').order('name');
    if (access.profile.store_id) query = query.eq('id', access.profile.store_id);
    const { data: stores, error } = await query;

    return (
        <section className="max-w-xl space-y-5">
            <h1>Add employee</h1>
            {error ? <p role="alert">Couldn’t load stores. Refresh to try again.</p>
                : stores?.length ? <AddEmployeeForm stores={stores} />
                : <p>A store must be available before you can add an employee.</p>}
        </section>
    );
}
