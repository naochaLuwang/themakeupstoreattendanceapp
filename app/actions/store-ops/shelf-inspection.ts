'use server';

import { operationsContext, operationError } from '@/lib/store-ops/context';
import { shelfSchema, uuid, validationMessage } from '@/lib/store-ops/validation';
import { uploadOperationsImage, removeOperationsImages } from '@/lib/store-ops/uploads';
import type { ShelfInspectionWithRelations, ShelfInspectionFilters } from '@/lib/store-ops/types';
import type { ShelfInspection } from '@/lib/store-ops/database.types';

export async function createStoreSection(name: string, description?: string, storeId?: string) {
    try {
        const { supabase, user, profile } = await operationsContext();
        if (profile.role !== 'admin' && profile.role !== 'manager') throw new Error('Manager permission is required.');
        if (!name.trim() || name.trim().length > 120) throw new Error('Enter a section name, up to 120 characters.');
        const store = storeId || profile.store_id;
        if (!store || !uuid.safeParse(store).success) throw new Error('Choose a store.');
        const { data, error } = await supabase.from('store_sections').insert({ name: name.trim(), description: description?.trim() || null, store_id: store, created_by: user.id }).select().single();
        if (error) throw new Error(error.message);
        return { error: undefined, success: true, data };
    } catch (error) { return operationError(error); }
}

export async function getStoreSections() {
    try {
        const { supabase } = await operationsContext();
        const { data, error } = await supabase.from('store_sections').select('*').order('name');
        if (error) throw new Error(error.message);
        return { error: undefined, success: true, data: data || [] };
    } catch (error) { return { ...operationError(error), data: [] }; }
}

export async function updateStoreSection(id:string,name:string,description?:string) {
    try {
        uuid.parse(id); const {supabase,profile}=await operationsContext();
        if(profile.role!=='admin'&&profile.role!=='manager')throw new Error('Manager permission required.');
        if(!name.trim()||name.trim().length>120||(description?.length||0)>500)throw new Error('Enter a section name up to 120 characters and a description up to 500 characters.');
        const {data,error}=await supabase.from('store_sections').update({name:name.trim(),description:description?.trim()||null}).eq('id',id).select('id').single();
        if(error||!data)throw new Error('Section was not updated.');return {success:true,error:undefined};
    }catch(error){return operationError(error);}
}

export async function deleteStoreSection(id:string) {
    try {
        uuid.parse(id); const {supabase,profile}=await operationsContext();
        if(profile.role!=='admin')throw new Error('Admin permission required.');
        const {data,error}=await supabase.from('store_sections').delete().eq('id',id).select('id').single();
        if(error?.code==='23503')throw new Error('This section has inspection history and must be retained.');
        if(error||!data)throw new Error('Section was not deleted.');return {success:true,error:undefined};
    }catch(error){return operationError(error);}
}

async function saveInspection(id: string | null, input: unknown) {
    const parsed = shelfSchema.safeParse(input);
    if (!parsed.success) return { error: validationMessage(parsed.error) };
    if (id && !uuid.safeParse(id).success) return { error: 'Invalid inspection.' };
    try {
        const { supabase } = await operationsContext(id ? 'shelf_inspection.edit' : 'shelf_inspection.create');
        const prior = id ? await supabase.from('inspection_images').select('url').eq('inspection_id', id) : null;
        const { data, error } = await supabase.rpc('store_ops_shelf_save', { p_id: id, p_data: { section_id: parsed.data.section_id, status: parsed.data.status, notes: parsed.data.notes || null, image_urls: parsed.data.image_urls || [] } });
        if (error || !data || typeof data !== 'object' || Array.isArray(data) || typeof data.id !== 'string') throw new Error(error?.message || 'Inspection was not saved.');
        const removed = (prior?.data || []).filter(photo => !parsed.data.image_urls?.includes(photo.url));
        if (removed.length) await removeOperationsImages(removed.map(photo => photo.url));
        return { error: undefined, success: true, data: data as unknown as ShelfInspection };
    } catch (error) { return operationError(error); }
}

export async function createShelfInspection(data: unknown) { return saveInspection(null, data); }
export async function updateShelfInspection(id: string, data: unknown) { return saveInspection(id, data); }

export async function deleteShelfInspection(id: string) {
    try {
        uuid.parse(id);
        const { supabase } = await operationsContext('shelf_inspection.delete');
        const { data: photos, error: photoError } = await supabase.from('inspection_images').select('url').eq('inspection_id', id);
        if (photoError) throw new Error(photoError.message);
        const { data, error } = await supabase.from('shelf_inspections').delete().eq('id', id).select('id').single();
        if (error || !data) throw new Error('Inspection was not deleted. It may be unavailable or outside your permissions.');
        await removeOperationsImages((photos || []).map(photo => photo.url));
        return { error: undefined, success: true };
    } catch (error) { return operationError(error); }
}

export async function approveShelfInspection(id: string) {
    try {
        uuid.parse(id);
        const { supabase, user } = await operationsContext('shelf_inspection.approve');
        const { data, error } = await supabase.from('shelf_inspections').update({ reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq('id', id).select().single();
        if (error || !data) throw new Error('Inspection could not be approved. Refresh and try again.');
        return { error: undefined, success: true, data };
    } catch (error) { return operationError(error); }
}

export async function addInspectionComment(inspectionId: string, comment: string) {
    try {
        uuid.parse(inspectionId);
        if (!comment.trim() || comment.trim().length > 2000) throw new Error('Enter a comment, up to 2,000 characters.');
        const { supabase, user } = await operationsContext('shelf_inspection.add_comment');
        const { data, error } = await supabase.from('inspection_comments').insert({ inspection_id: inspectionId, comment: comment.trim(), created_by: user.id }).select('*, profiles:profiles!created_by(full_name)').single();
        if (error) throw new Error(error.message);
        return { error: undefined, success: true, data };
    } catch (error) { return operationError(error); }
}

export async function uploadInspectionImage(form: FormData) { return uploadOperationsImage(form, 'shelf-inspection'); }

export async function getShelfInspectionPage(filters: ShelfInspectionFilters = {}) {
    try {
        const { supabase } = await operationsContext();
        const page = Math.max(1, Math.floor(filters.page || 1));
        const limit = Math.min(100, Math.max(1, Math.floor(filters.limit || 20)));
        let query = supabase.from('shelf_inspections').select('*, store_sections(name, description), profiles:profiles!employee_id(full_name, email), inspection_images(*), inspection_comments(*, profiles:profiles!created_by(full_name))', { count: 'exact' });
        if (filters.status) query = query.eq('status', filters.status);
        if (filters.section_id) query = query.eq('section_id', filters.section_id);
        if (filters.search?.trim()) {
            const search = filters.search.trim().replace(/[,%()\\]/g, ' ').slice(0, 100);
            const { data: sections, error } = await supabase.from('store_sections').select('id').ilike('name', `%${search}%`);
            if (error) throw new Error(error.message);
            query = sections?.length ? query.or(`notes.ilike.%${search}%,section_id.in.(${sections.map(section => section.id).join(',')})`) : query.ilike('notes', `%${search}%`);
        }
        const { data, count, error } = await query.order('created_at', { ascending: false }).range((page - 1) * limit, page * limit - 1);
        if (error) throw new Error('Inspections could not be loaded. Please retry.');
        return { error: undefined, data: (data || []) as ShelfInspectionWithRelations[], total: count || 0, totalPages: Math.ceil((count || 0) / limit) };
    } catch (error) { return { ...operationError(error), data: [] as ShelfInspectionWithRelations[], total: 0, totalPages: 0 }; }
}
