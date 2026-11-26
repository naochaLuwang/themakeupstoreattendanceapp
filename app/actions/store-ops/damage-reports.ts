'use server';
import { operationsContext, operationError } from '@/lib/store-ops/context';
import { damageSchema, uuid, validationMessage } from '@/lib/store-ops/validation';
import { uploadOperationsImage, removeOperationsImages } from '@/lib/store-ops/uploads';
import type { Database, Json } from '@/lib/supabase/database.types';
type Report = Database['public']['Tables']['damage_reports']['Row'];

async function saveReport(id: string | null, input: unknown) {
    const parsed = damageSchema.safeParse(input);
    if (!parsed.success) return operationError(new Error(validationMessage(parsed.error)));
    try {
        if (id) uuid.parse(id);
        const { supabase } = await operationsContext(id ? 'damage_reports.edit' : 'damage_reports.create');
        const prior = id ? await supabase.from('damage_images').select('url').eq('damage_report_id', id) : null;
        const payload = { ...parsed.data, image_urls: parsed.data.image_urls || [] };
        const { data, error } = await supabase.rpc('store_ops_damage_save', { p_id: id, p_data: payload as Json });
        if (error || !data || typeof data !== 'object' || Array.isArray(data) || typeof data.id !== 'string') throw new Error(error?.message || 'Report was not saved.');
        await removeOperationsImages((prior?.data || []).filter(image => !payload.image_urls.includes(image.url)).map(image => image.url));
        return { success: true, error: undefined, data: data as unknown as Report };
    } catch (error) { return operationError(error); }
}
export async function createDamageReport(input: unknown) { return saveReport(null, input); }
export async function updateDamageReport(id: string, input: unknown) { return saveReport(id, input); }

async function review(id: string, status: 'approved' | 'rejected' | 'archived') {
    try {
        uuid.parse(id);
        const { supabase, user } = await operationsContext(status === 'archived' ? 'damage_reports.archive' : status === 'approved' ? 'damage_reports.approve' : 'damage_reports.reject');
        let query = supabase.from('damage_reports').update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', id);
        query = status === 'archived' ? query.in('status', ['approved', 'rejected']) : query.eq('status', 'pending');
        const { data, error } = await query.select().single();
        if (error || !data) throw new Error('Report was not changed. It may have already been reviewed. Refresh and retry.');
        return { success: true, error: undefined, data };
    } catch (error) { return operationError(error); }
}
export async function approveDamageReport(id: string) { return review(id, 'approved'); }
export async function rejectDamageReport(id: string) { return review(id, 'rejected'); }
export async function archiveDamageReport(id: string) { return review(id, 'archived'); }
export async function uploadDamageImage(form: FormData) { return uploadOperationsImage(form, 'damage-reports'); }

export async function deleteDamageReport(id: string) {
    try {
        uuid.parse(id); const { supabase } = await operationsContext('damage_reports.delete');
        const { data: images, error: readError } = await supabase.from('damage_images').select('url').eq('damage_report_id', id);
        if (readError) throw new Error(readError.message);
        const { data, error } = await supabase.from('damage_reports').delete().eq('id', id).select('id').single();
        if (error || !data) throw new Error('The report could not be deleted.');
        await removeOperationsImages((images || []).map(image => image.url));
        return { success: true, error: undefined };
    } catch (error) { return operationError(error); }
}
export async function addDamageComment(id: string, comment: string) {
    try {
        uuid.parse(id); if (!comment.trim() || comment.length > 2000) throw new Error('Enter a comment, up to 2,000 characters.');
        const { supabase, user } = await operationsContext('damage_reports.add_comment');
        const { data, error } = await supabase.from('damage_comments').insert({ damage_report_id: id, comment: comment.trim(), created_by: user.id }).select('*, profiles:profiles!created_by(full_name)').single();
        if (error) throw new Error(error.message);
        return { success: true, error: undefined, data };
    } catch (error) { return operationError(error); }
}
export async function deleteDamageImage(id: string) {
    try {
        uuid.parse(id); const { supabase } = await operationsContext('damage_reports.upload_image');
        const { data, error } = await supabase.from('damage_images').delete().eq('id', id).select('url').single();
        if (error || !data) throw new Error('The photo could not be removed.');
        await removeOperationsImages([data.url]);
        return { success: true, error: undefined };
    } catch (error) { return operationError(error); }
}

export async function getDamageReturnList() {
    const { supabase } = await operationsContext('damage_reports.approve');
    const { data, error } = await supabase.from('damage_reports').select('id,barcode,product_name,brand,shade,batch,mrp,quantity,damage_type,created_at').eq('status','approved').order('created_at');
    if (error) throw new Error('The return list could not be loaded.');
    return data || [];
}
