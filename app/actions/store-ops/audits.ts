'use server'

import { createClient } from '@/lib/supabase/server';
import { operationsContext, operationError } from '@/lib/store-ops/context';
import { uploadOperationsImage, removeOperationsImages } from '@/lib/store-ops/uploads';
import { uuid } from '@/lib/store-ops/validation';
import type { Database, Json } from '@/lib/supabase/database.types';
import { z } from 'zod';

export async function createAuditTemplate(input: unknown) {
  try {
    const data=z.object({name:z.string().trim().min(1).max(200),category:z.enum(['display','cleanliness','staff','lighting','product_placement','price_tags','promotions','safety']),store_id:uuid.optional(),questions:z.array(z.object({question:z.string().trim().min(1).max(500),max_score:z.number().int().min(1).max(100)})).min(1).max(100)}).parse(input);
    const {supabase,profile}=await operationsContext();if(profile.role!=='admin'&&profile.role!=='manager')throw new Error('Manager permission required.');
    const {data:template,error}=await supabase.rpc('store_ops_audit_template',{p_data:data as Json});
    if(error)throw new Error(error.message);return {success:true,error:undefined,data:template};
  }catch(error){return operationError(error);}
}

export async function deleteAuditTemplate(id: string) {
  if (!uuid.safeParse(id).success) return { error: 'Invalid template.' };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return { error: 'Forbidden' };

  const { data: deleted, error } = await supabase
    .from('audit_templates')
    .delete()
    .eq('id', id).select('id').single();

  if (error || !deleted) return { error: error?.code === '23503' ? 'Templates with audit history must be retained.' : 'Template could not be deleted. Refresh and retry.' };
  return { success: true };
}

export async function startAudit(templateId:string) {
  try { const {supabase,profile}=await operationsContext();if(profile.role!=='admin'&&profile.role!=='manager')throw new Error('Manager permission required.');
    const {data,error}=await supabase.rpc('store_ops_audit_start',{p_template:uuid.parse(templateId)});
    if(error||!data||typeof data!=='object'||Array.isArray(data)||typeof data.id!=='string')throw new Error(error?.message||'Audit could not be started.');
    return {success:true,error:undefined,data:data as unknown as Database['public']['Tables']['audits']['Row']};
  }catch(error){return operationError(error);}
}

export async function submitAuditAnswer(
  auditId: string,
  questionId: string,
  score: number,
  comment?: string,
  photoUrl?: string
) {
  const {supabase,profile}=await operationsContext();
  if(profile.role!=='admin'&&profile.role!=='manager')return {error:'Manager permission required.'};
  if(!uuid.safeParse(auditId).success||!uuid.safeParse(questionId).success||!Number.isInteger(score)||score<0||score>100)return {error:'Invalid audit answer.'};
  const { data: changed, error } = await supabase
    .from('audit_answers')
    .update({
      score,
      comment: comment || null,
      photo_url: photoUrl || null,
    })
    .eq('audit_id', auditId)
    .eq('question_id', questionId).select('id').single();

  if (error || !changed) return { error: error?.message || 'Answer was not saved.' };
  return { success: true };
}

export async function completeAudit(auditId:string) {
  try {const {supabase,profile}=await operationsContext();if(profile.role!=='admin'&&profile.role!=='manager')throw new Error('Manager permission required.');
    const {data,error}=await supabase.from('audits').update({status:'completed'}).eq('id',uuid.parse(auditId)).eq('status','in_progress').select('final_score,max_score').single();
    if(error||!data)throw new Error(error?.message||'Audit was not completed.');
    return {success:true,error:undefined,data:{final_score:data.final_score||0,max_score:data.max_score||0}};
  }catch(error){return operationError(error);}
}
export async function uploadAuditImage(form:FormData){return uploadOperationsImage(form,'audits');}

export async function deleteAudit(id:string) {
  try {
    const {supabase,profile}=await operationsContext();
    if(profile.role!=='admin')throw new Error('Admin permission required.');
    const {data:photos,error:readError}=await supabase.from('audit_answers').select('photo_url').eq('audit_id',uuid.parse(id));
    if(readError)throw new Error('Audit photos could not be checked.');
    const {data,error}=await supabase.from('audits').delete().eq('id',id).select('id').single();
    if(error||!data)throw new Error('Audit could not be deleted.');
    await removeOperationsImages((photos||[]).flatMap(photo=>photo.photo_url?[photo.photo_url]:[]));
    return {success:true,error:undefined};
  }catch(error){return operationError(error);}
}
