import { createClient } from '@/lib/supabase/server';
import BottomNav from './BottomNav';

export default async function NavWrapper() {
    const supabase = await createClient();

    // Dynamic data access starts here
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { count } = await supabase
        .from('swap_requests')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('status', 'pending');

    return <BottomNav userId={user.id} initialCount={count || 0} />;
}