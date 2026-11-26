import { notFound } from 'next/navigation';
import { operationsContext } from '@/lib/store-ops/context';
import DamageReportForm from '@/components/store-ops/damage-reports/DamageReportForm';
export default async function EditDamage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { supabase } = await operationsContext('damage_reports.edit');
    const { data, error } = await supabase.from('damage_reports').select('*,damage_images(url)').eq('id', id).single();
    if (error || !data) notFound();
    return <DamageReportForm initialData={data} />;
}
