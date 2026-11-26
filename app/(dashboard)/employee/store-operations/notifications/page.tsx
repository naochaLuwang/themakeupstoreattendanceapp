import { operationsContext } from '@/lib/store-ops/context';
import OperationsNotifications from '@/components/store-ops/notifications/OperationsNotifications';
export default async function Notifications() {
    const { supabase, user } = await operationsContext();
    const { data, error } = await supabase.from('store_operation_preferences').select('enabled,push_enabled').eq('user_id', user.id).maybeSingle();
    if (error) throw new Error('Notification preferences could not be loaded.');
    return <OperationsNotifications userId={user.id} initial={data || { enabled: true, push_enabled: false }} />;
}
