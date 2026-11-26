import { notFound } from 'next/navigation';
import ShelfInspectionForm from '@/components/store-ops/shelf-inspection/ShelfInspectionForm';
import { operationsContext } from '@/lib/store-ops/context';

export default async function EditInspection({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { supabase } = await operationsContext('shelf_inspection.edit');
    const { data, error } = await supabase.from('shelf_inspections').select('*, inspection_images(url)').eq('id', id).single();
    if (error || !data) notFound();
    return <ShelfInspectionForm initialData={data} />;
}
