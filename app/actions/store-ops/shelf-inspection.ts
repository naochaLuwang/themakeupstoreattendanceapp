'use server'

import { createClient } from '@/lib/supabase/server';
import { can, canManageApprovals, canDelete } from '@/lib/store-ops/permissions';

export async function createStoreSection(name: string, description?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data, error } = await supabase
    .from('store_sections')
    .insert({ name, description: description || null, created_by: user.id })
    .select()
    .single();

  if (error) return { error: error.message };
  return { success: true, data };
}

export async function getStoreSections() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('store_sections')
    .select('*')
    .order('name', { ascending: true });

  if (error) return { error: error.message };
  return { success: true, data: data || [] };
}

export async function createShelfInspection(data: {
  section_id: string
  status: string
  notes?: string
  image_urls?: string[]
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'shelf_inspection.create')) {
    return { error: 'Forbidden' };
  }

  const { data: inspection, error } = await supabase
    .from('shelf_inspections')
    .insert({
      section_id: data.section_id,
      employee_id: user.id,
      status: data.status,
      notes: data.notes || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (data.image_urls && data.image_urls.length > 0) {
    const imageRows = data.image_urls.map(url => ({
      inspection_id: inspection.id,
      url,
      created_by: user.id,
    }));

    const { error: imgError } = await supabase
      .from('inspection_images')
      .insert(imageRows);

    if (imgError) return { error: imgError.message };
  }

  return { success: true, data: inspection };
}

export async function updateShelfInspection(
  id: string,
  data: Partial<{
    section_id: string
    status: string
    notes: string
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

  if (!profile || !can(profile.role, 'shelf_inspection.edit')) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('shelf_inspections')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteShelfInspection(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !canDelete(profile.role)) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('shelf_inspections')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function approveShelfInspection(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !canManageApprovals(profile.role)) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('shelf_inspections')
    .update({
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function addInspectionComment(inspectionId: string, comment: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'shelf_inspection.add_comment')) {
    return { error: 'Forbidden' };
  }

  const { data, error } = await supabase
    .from('inspection_comments')
    .insert({
      inspection_id: inspectionId,
      comment,
      created_by: user.id,
    })
    .select('*, profiles:created_by(full_name)')
    .single();

  if (error) return { error: error.message };
  return { success: true, data };
}

export async function uploadInspectionImage(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };

  const ext = file.name.split('.').pop();
  const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('store-images')
    .upload(`shelf-inspection/${fileName}`, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from('store-images')
    .getPublicUrl(`shelf-inspection/${fileName}`);

  return { success: true, url: publicUrl };
}
