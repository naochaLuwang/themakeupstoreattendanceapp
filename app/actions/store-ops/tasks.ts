'use server'

import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/store-ops/permissions';

export async function createTask(data: {
  title: string
  description?: string
  assigned_to?: string
  priority: string
  due_date?: string
  category?: string
  is_recurring?: boolean
  recurrence_rule?: string
}) {
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
      title: data.title,
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

  const { error } = await supabase
    .from('tasks')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
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

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
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

  const { error } = await supabase
    .from('tasks')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
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

  const { error } = await supabase
    .from('tasks')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
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
    .select('*, profiles:created_by(full_name)')
    .single();

  if (error) return { error: error.message };
  return { success: true, data };
}

export async function uploadTaskAttachment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };

  const ext = file.name.split('.').pop();
  const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('store-images')
    .upload(`tasks/${fileName}`, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from('store-images')
    .getPublicUrl(`tasks/${fileName}`);

  return { success: true, url: publicUrl };
}

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

  const path = attachment.url.split('/store-images/')[1];
  if (path) {
    await supabase.storage.from('store-images').remove([path]);
  }

  const { error } = await supabase
    .from('task_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) return { error: error.message };
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
      assigned_to_profile:assigned_to(full_name),
      assigned_by_profile:assigned_by(full_name),
      task_comments(*, profiles:created_by(full_name)),
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
    data: (data || []) as any[],
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
      assigned_to_profile:assigned_to(full_name),
      assigned_by_profile:assigned_by(full_name),
      task_comments(*, profiles:created_by(full_name)),
      task_attachments(*)
    `)
    .eq('id', id)
    .single();

  if (error) return { error: error.message, data: null };
  return { data: data as any, error: null };
}

export async function getEmployees() {
  const supabase = await createClient();

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'employee')
    .order('full_name');

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
