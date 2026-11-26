import { operationsContext } from '@/lib/store-ops/context';
import OperationsTimingSettings from '@/components/store-ops/OperationsTimingSettings';
import SectionSettings from '@/components/store-ops/shelf-inspection/SectionSettings';

export default async function OperationsSettings() {
    const { supabase, profile } = await operationsContext();
    let storesQuery = supabase.from('stores').select('id, name').order('name');
    if (profile.role !== 'admin') storesQuery = storesQuery.eq('id', profile.store_id || '');
    const [stores, sections, settings] = await Promise.all([storesQuery, supabase.from('store_sections').select('id, name, description, store_id').order('name'),supabase.from('store_operations_settings').select('*')]);
    if (stores.error || sections.error || settings.error) throw new Error('Store settings could not be loaded.');
    return <div className="space-y-10"><SectionSettings stores={(stores.data || []).map(store => ({ ...store, name: store.name || 'Store' }))} sections={sections.data || []} canDelete={profile.role==='admin'} /><OperationsTimingSettings stores={stores.data||[]} settings={settings.data||[]}/></div>;
}
