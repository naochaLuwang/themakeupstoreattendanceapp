'use server'

import { createClient } from '@/lib/supabase/server';

export async function createTemplate(data: {
  name: string
  type: 'opening' | 'closing'
  items: string[]
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    return { error: 'Forbidden' };
  }

  const { data: template, error } = await supabase
    .from('checklist_templates')
    .insert({
      name: data.name,
      type: data.type,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (data.items.length > 0) {
    const { error: itemError } = await supabase
      .from('daily_checklist_items')
      .insert(
        data.items.map((label, i) => ({
          daily_checklist_id: template.id,
          label,
          sort_order: i,
          created_by: user.id,
        }))
      );

    if (itemError) return { error: itemError.message };
  }

  return { success: true, data: template };
}

export async function updateTemplate(
  id: string,
  data: { name?: string; type?: 'opening' | 'closing'; items?: string[]; is_active?: boolean }
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'admin' && profile.role !== 'manager')) {
    return { error: 'Forbidden' };
  }

  if (data.name || data.type !== undefined || data.is_active !== undefined) {
    const { error } = await supabase
      .from('checklist_templates')
      .update({
        ...(data.name && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
      })
      .eq('id', id);

    if (error) return { error: error.message };
  }

  if (data.items) {
    const { error: deleteError } = await supabase
      .from('daily_checklist_items')
      .delete()
      .eq('daily_checklist_id', id);

    if (deleteError) return { error: deleteError.message };

    const { error: insertError } = await supabase
      .from('daily_checklist_items')
      .insert(
        data.items.map((label, i) => ({
          daily_checklist_id: id,
          label,
          sort_order: i,
          created_by: user.id,
        }))
      );

    if (insertError) return { error: insertError.message };
  }

  return { success: true };
}

export async function deleteTemplate(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin') return { error: 'Forbidden' };

  const { error } = await supabase
    .from('checklist_templates')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function startDailyChecklist(templateId: string, type: 'opening' | 'closing') {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('daily_checklists')
    .select('id')
    .eq('type', type)
    .eq('date', today)
    .maybeSingle();

  if (existing) return { error: 'Already have a checklist for today', data: existing };

  const { data: templateItems } = await supabase
    .from('daily_checklist_items')
    .select('label, sort_order')
    .eq('daily_checklist_id', templateId)
    .order('sort_order');

  const { data: checklist, error } = await supabase
    .from('daily_checklists')
    .insert({
      template_id: templateId,
      type,
      date: today,
      status: 'in_progress',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (templateItems && templateItems.length > 0) {
    const { error: itemError } = await supabase
      .from('daily_checklist_items')
      .insert(
        templateItems.map(item => ({
          daily_checklist_id: checklist.id,
          label: item.label,
          sort_order: item.sort_order,
          created_by: user.id,
        }))
      );

    if (itemError) return { error: itemError.message };
  }

  return { success: true, data: checklist };
}

export async function completeChecklistItem(itemId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: item } = await supabase
    .from('daily_checklist_items')
    .select('is_completed')
    .eq('id', itemId)
    .single();

  if (!item) return { error: 'Item not found' };

  const { error } = await supabase
    .from('daily_checklist_items')
    .update({
      is_completed: !item.is_completed,
      completed_by: !item.is_completed ? user.id : null,
      completed_at: !item.is_completed ? new Date().toISOString() : null,
    })
    .eq('id', itemId);

  if (error) return { error: error.message };
  return { success: true, completed: !item.is_completed };
}

export async function uploadChecklistPhoto(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };

  const ext = file.name.split('.').pop();
  const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('store-images')
    .upload(`checklists/${fileName}`, file, { cacheControl: '3600', upsert: false });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from('store-images')
    .getPublicUrl(`checklists/${fileName}`);

  return { success: true, url: publicUrl };
}

export async function completeDailyChecklist(checklistId: string, photoUrl?: string, notes?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('daily_checklists')
    .update({
      status: 'completed',
      completed_by: user.id,
      completed_at: new Date().toISOString(),
      photo_url: photoUrl || null,
      notes: notes || null,
    })
    .eq('id', checklistId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function getTodayChecklist(type: 'opening' | 'closing') {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('daily_checklists')
    .select(`
      *,
      daily_checklist_items(*, profiles:completed_by(full_name))
    `)
    .eq('type', type)
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  return data as any;
}

export async function getTemplates() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('checklist_templates')
    .select('*')
    .order('type')
    .order('name');

  return (data || []) as any[];
}

export async function getTemplateWithItems(id: string) {
  const supabase = await createClient();
  const { data: template } = await supabase
    .from('checklist_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (!template) return null;

  const { data: items } = await supabase
    .from('daily_checklist_items')
    .select('*')
    .eq('daily_checklist_id', id)
    .order('sort_order');

  return { ...template, items: items || [] };
}

export async function getChecklistHistory(type?: 'opening' | 'closing', limit = 30) {
  const supabase = await createClient();
  let query = supabase
    .from('daily_checklists')
    .select(`
      *,
      profiles:completed_by(full_name),
      checklist_templates!inner(name),
      daily_checklist_items(*)
    `)
    .order('date', { ascending: false })
    .limit(limit);

  if (type) query = query.eq('type', type);

  const { data } = await query;
  return (data || []) as any[];
}
