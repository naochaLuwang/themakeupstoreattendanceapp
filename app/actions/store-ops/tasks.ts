'use server'

import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/store-ops/permissions';
import { taskSchema, validationMessage } from '@/lib/store-ops/validation';
import { uploadOperationsImage, removeOperationsImages } from '@/lib/store-ops/uploads';
import type { TaskWithRelations } from '@/lib/store-ops/types';

export async function createTask(data: {
  store_id?: string
  title: string
  description?: string
  assigned_to?: string
  priority: string
  due_date?: string
  category?: string
  is_recurring?: boolean
  recurrence_rule?: string
}) {
  const parsed = taskSchema.safeParse(data);
  if (!parsed.success) return { error: validationMessage(parsed.error) };
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'tasks.create')) {
    return { error: 'Forbidden' };
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      store_id: data.store_id,
      title: parsed.data.title,
      description: data.description || null,
      assigned_to: data.assigned_to || null,
      assigned_by: user.id,
      priority: data.priority,
      due_date: data.due_date || null,
      category: data.category || null,
      is_recurring: data.is_recurring || false,
      recurrence_rule: data.recurrence_rule || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };
  return { success: true, data: task };
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string
    description: string
    assigned_to: string
    priority: string
    due_date: string
    category: string
    is_recurring: boolean
    recurrence_rule: string
    status: string
  }>
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'tasks.edit')) {
    return { error: 'Forbidden' };
  }

  const { data: changed, error } = await supabase
    .from('tasks')
    .update({ title: data.title, description: data.description, assigned_to: data.assigned_to, priority: data.priority, due_date: data.due_date, category: data.category, is_recurring: data.is_recurring, recurrence_rule: data.recurrence_rule, status: data.status, updated_at: new Date().toISOString() })
    .eq('id', id).select('id').single();

  if (error || !changed) return { error: error?.message || 'Task was not changed. Refresh and retry.' };
  return { success: true };
}

export async function deleteTask(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'tasks.delete')) {
    return { error: 'Forbidden' };
  }

  const {data:attachments,error:attachmentError}=await supabase.from('task_attachments').select('url').eq('task_id',id);
  if(attachmentError)return {error:'Task photos could not be checked.'};
  const { data: changed, error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id).select('id').single();

  if (error || !changed) return { error: error?.message || 'Task was not changed. Refresh and retry.' };
  await removeOperationsImages((attachments||[]).map(attachment=>attachment.url));
  return { success: true };
}

export async function completeTask(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'tasks.complete')) {
    return { error: 'Forbidden' };
  }

  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (!task) return { error: 'Task not found' };

  const newStatus = task.status === 'completed' ? 'pending' : 'completed';

  const { data: changed, error } = await supabase
    .from('tasks')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id).eq('status', task.status).select('id').single();

  if (error || !changed) return { error: error?.message || 'Task was not completed. Refresh and retry.' };
  return { success: true, data: { status: newStatus } };
}

export async function cancelTask(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'tasks.edit')) {
    return { error: 'Forbidden' };
  }

  const { data: changed, error } = await supabase
    .from('tasks')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id).select('id').single();

  if (error || !changed) return { error: error?.message || 'Task was not changed. Refresh and retry.' };
  return { success: true };
}

export async function addTaskComment(taskId: string, comment: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'tasks.add_comment')) {
    return { error: 'Forbidden' };
  }

  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      task_id: taskId,
      comment,
      created_by: user.id,
    })
    .select('*, profiles:profiles!created_by(full_name)')
    .single();

  if (error) return { error: error.message };
  return { success: true, data };
}

export async function uploadTaskAttachment(formData: FormData) { return uploadOperationsImage(formData, 'tasks'); }

export async function deleteTaskAttachment(attachmentId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: attachment } = await supabase
    .from('task_attachments')
    .select('url')
    .eq('id', attachmentId)
    .single();

  if (!attachment) return { error: 'Attachment not found' };

  const { error } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) return { error: error.message };
  await removeOperationsImages([attachment.url]);
  return { success: true };
}

export async function getTasks(filters?: {
  search?: string
  status?: string
  priority?: string
  category?: string
  assigned_to?: string
  page?: number
  limit?: number
}) {
  const supabase = await createClient();
  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('tasks')
    .select(`
      *,
      assigned_to_profile:profiles!assigned_to(full_name),
      assigned_by_profile:profiles!assigned_by(full_name),
      task_comments(*, profiles:profiles!created_by(full_name)),
      task_attachments(*)
    `, { count: 'exact' });

  if (filters?.search) {
    query = query.ilike('title', `%${filters.search}%`);
  }
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.priority) query = query.eq('priority', filters.priority);
  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.assigned_to) query = query.eq('assigned_to', filters.assigned_to);

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { error: error.message, data: [], total: 0, totalPages: 0 };
  return {
    data: (data || []) as TaskWithRelations[],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
    page,
  };
}

export async function getTaskById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      assigned_to_profile:profiles!assigned_to(full_name),
      assigned_by_profile:profiles!assigned_by(full_name),
      task_comments(*, profiles:profiles!created_by(full_name)),
      task_attachments(*)
    `)
    .eq('id', id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data: data as TaskWithRelations, error: null };
}

export async function getEmployees(storeId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase.from('profiles').select('role,store_id').eq('id',user.id).single();
  if (!profile || !can(profile.role,'tasks.assign')) return [];
  let query = supabase.from('profiles').select('id,full_name,email').eq('role','employee');
  if (profile.role !== 'admin' || storeId) query=query.eq('store_id',profile.role === 'admin' ? storeId! : profile.store_id || '');
  const {data,error}=await query.order('full_name');
  if (error) throw new Error('Employees could not be loaded.');
  return data || [];
}

export async function saveTaskAttachment(taskId: string, url: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('task_attachments')
    .insert({
      task_id: taskId,
      url,
      created_by: user.id,
    });

  if (error) return { error: error.message };
  return { success: true };
}
