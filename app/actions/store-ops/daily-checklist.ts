'use server';
import { z } from 'zod';
import { getAttendanceDate } from '@/lib/attendance/date';
import { operationsContext, operationError } from '@/lib/store-ops/context';
import { uploadOperationsImage } from '@/lib/store-ops/uploads';
import { uuid } from '@/lib/store-ops/validation';
import type { Json } from '@/lib/supabase/database.types';

const templateSchema = z.object({name:z.string().trim().min(1).max(120),type:z.enum(['opening','closing']),items:z.array(z.string().trim().min(1).max(300)).min(1).max(100),store_id:uuid.optional(),requires_photo:z.boolean().optional()});
async function saveTemplate(id: string | null, input: unknown) {
    try {
        const parsed = templateSchema.parse(input); const { supabase, profile } = await operationsContext();
        if (profile.role !== 'admin' && profile.role !== 'manager') throw new Error('Manager permission required.');
        const { data, error } = await supabase.rpc('store_ops_checklist_template', { p_id:id,p_data:parsed as Json });
        if (error) throw new Error(error.message);
        return { success:true,error:undefined,data };
    } catch (error) { return operationError(error); }
}
export async function createTemplate(data: unknown) { return saveTemplate(null,data); }
export async function updateTemplate(id:string,data:{name?:string;type?:'opening'|'closing';items?:string[];is_active?:boolean;requires_photo?:boolean}) {
    try {
        const { supabase, profile }=await operationsContext();
        if(profile.role!=='admin' && profile.role!=='manager') throw new Error('Manager permission required.');
        if(data.is_active!==undefined && !data.items) {
            const {data:changed,error}=await supabase.from('checklist_templates').update({is_active:data.is_active}).eq('id',uuid.parse(id)).select('id').single();
            if(error || !changed) throw new Error('Template was not updated.');
            return {success:true,error:undefined};
        }
        const existing=await getTemplateWithItems(id);
        if(!existing) throw new Error('Template unavailable.');
        return saveTemplate(id,{...existing,...data,items:data.items || existing.items.map(item=>item.label),store_id:existing.store_id || undefined});
    } catch(error) {return operationError(error);}
}
export async function deleteTemplate(id:string) {
    try {const {supabase,profile}=await operationsContext(); if(profile.role!=='admin') throw new Error('Admin permission required.');
        // Archive templates so historical checklist references remain intact.
        const {data,error}=await supabase.from('checklist_templates').update({is_active:false}).eq('id',uuid.parse(id)).select('id').single();
        if(error||!data) throw new Error('Template could not be archived.'); return {success:true,error:undefined};
    }catch(error){return operationError(error);}
}
export async function startDailyChecklist(templateId:string, type:'opening'|'closing') {
    try {const {supabase}=await operationsContext();
        const {data:template}=await supabase.from('checklist_templates').select('type').eq('id',uuid.parse(templateId)).single();
        if(template?.type!==type) throw new Error('Template type does not match.');
        const {data,error}=await supabase.rpc('store_ops_checklist_start',{p_template:templateId});
        if(error) throw new Error(error.message); return {success:true,error:undefined,data};
    }catch(error){return operationError(error);}
}
export async function completeChecklistItem(itemId:string) {
    try {const {supabase,user}=await operationsContext(); const {data:item,error:readError}=await supabase.from('daily_checklist_items').select('is_completed').eq('id',uuid.parse(itemId)).single();
        if(readError||!item) throw new Error('Checklist item unavailable.');
        const {data,error}=await supabase.from('daily_checklist_items').update({is_completed:!item.is_completed,completed_by:!item.is_completed?user.id:null,completed_at:!item.is_completed?new Date().toISOString():null}).eq('id',itemId).eq('is_completed',item.is_completed).select('is_completed').single();
        if(error||!data) throw new Error(error?.message || 'This item changed. Refresh and retry.');
        return {success:true,error:undefined,completed:data.is_completed};
    }catch(error){return {...operationError(error),completed:undefined};}
}
export async function uploadChecklistPhoto(form:FormData){return uploadOperationsImage(form,'checklists');}
export async function completeDailyChecklist(id:string,photoUrl?:string,notes?:string) {
    try {const {supabase,user}=await operationsContext();
        const {data,error}=await supabase.from('daily_checklists').update({status:'completed',completed_by:user.id,completed_at:new Date().toISOString(),photo_url:photoUrl||null,notes:notes?.trim().slice(0,5000)||null}).eq('id',uuid.parse(id)).eq('status','in_progress').select('id').single();
        if(error||!data) throw new Error(error?.message||'Checklist was not completed.'); return {success:true,error:undefined};
    }catch(error){return operationError(error);}
}
export async function getTodayChecklist(type:'opening'|'closing',storeId?:string) {
    const {supabase,profile}=await operationsContext();
    let query=supabase.from('daily_checklists').select('*,daily_checklist_items(*,profiles:profiles!completed_by(full_name))').eq('type',type).eq('date',getAttendanceDate()).is('superseded_at',null);
    if(storeId || profile.store_id) query=query.eq('store_id',storeId || profile.store_id!);
    const {data,error}=await query.order('created_at',{ascending:false}).limit(1).maybeSingle();
    if(error) throw new Error('Today’s checklist could not be loaded.'); return data;
}
export async function getTemplates() {
    const {supabase}=await operationsContext();const {data,error}=await supabase.from('checklist_templates').select('*').eq('is_active',true).order('type').order('name');
    if(error) throw new Error('Checklist templates could not be loaded.');return data||[];
}
export async function getTemplateWithItems(id:string) {
    const {supabase}=await operationsContext();const {data,error}=await supabase.from('checklist_templates').select('*').eq('id',uuid.parse(id)).single();
    if(error||!data)return null;
    const {data:items,error:itemError}=await supabase.from('checklist_template_items').select('*').eq('template_id',id).eq('is_active',true).order('sort_order');
    if(itemError) throw new Error('Template items could not be loaded.'); return {...data,items:items||[]};
}
export async function getChecklistHistory(type?:'opening'|'closing',limit=30) {
    const {supabase}=await operationsContext();let query=supabase.from('daily_checklists').select('*,profiles:profiles!completed_by(full_name),checklist_templates!inner(name),daily_checklist_items(*)').order('date',{ascending:false}).limit(Math.min(100,Math.max(1,limit)));
    if(type)query=query.eq('type',type); const {data,error}=await query;if(error)throw new Error('Checklist history could not be loaded.');return data||[];
}
