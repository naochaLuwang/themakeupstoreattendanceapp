'use server'

import { createClient } from '@/lib/supabase/server';
import { can, canManageApprovals, canDelete } from '@/lib/store-ops/permissions';

export async function createDamageReport(data: {
  barcode: string
  product_name: string
  brand?: string
  shade?: string
  batch?: string
  mrp?: number
  quantity: number
  damage_type: string
  description?: string
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

  if (!profile || !can(profile.role, 'damage_reports.create')) {
    return { error: 'Forbidden' };
  }

  const { data: report, error } = await supabase
    .from('damage_reports')
    .insert({
      barcode: data.barcode,
      product_name: data.product_name,
      brand: data.brand || null,
      shade: data.shade || null,
      batch: data.batch || null,
      mrp: data.mrp || null,
      quantity: data.quantity,
      damage_type: data.damage_type,
      description: data.description || null,
      reported_by: user.id,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (data.image_urls && data.image_urls.length > 0) {
    const imageRows = data.image_urls.map(url => ({
      damage_report_id: report.id,
      url,
      created_by: user.id,
    }));

    const { error: imgError } = await supabase
      .from('damage_images')
      .insert(imageRows);

    if (imgError) return { error: imgError.message };
  }

  return { success: true, data: report };
}

export async function updateDamageReport(
  id: string,
  data: Partial<{
    barcode: string
    product_name: string
    brand: string
    shade: string
    batch: string
    mrp: number
    quantity: number
    damage_type: string
    description: string
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

  if (!profile || !can(profile.role, 'damage_reports.edit')) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('damage_reports')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteDamageReport(id: string) {
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
    .from('damage_reports')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function approveDamageReport(id: string) {
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
    .from('damage_reports')
    .update({
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function rejectDamageReport(id: string) {
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
    .from('damage_reports')
    .update({
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function archiveDamageReport(id: string) {
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
    .from('damage_reports')
    .update({
      status: 'archived',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function addDamageComment(reportId: string, comment: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'damage_reports.add_comment')) {
    return { error: 'Forbidden' };
  }

  const { data, error } = await supabase
    .from('damage_comments')
    .insert({
      damage_report_id: reportId,
      comment,
      created_by: user.id,
    })
    .select('*, profiles:created_by(full_name)')
    .single();

  if (error) return { error: error.message };
  return { success: true, data };
}

export async function uploadDamageImage(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };

  const ext = file.name.split('.').pop();
  const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('store-images')
    .upload(`damage-reports/${fileName}`, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from('store-images')
    .getPublicUrl(`damage-reports/${fileName}`);

  return { success: true, url: publicUrl };
}

export async function deleteDamageImage(imageId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: image } = await supabase
    .from('damage_images')
    .select('url')
    .eq('id', imageId)
    .single();

  if (!image) return { error: 'Image not found' };

  const path = image.url.split('/store-images/')[1];
  if (path) {
    await supabase.storage.from('store-images').remove([path]);
  }

  const { error } = await supabase
    .from('damage_images')
    .delete()
    .eq('id', imageId);

  if (error) return { error: error.message };
  return { success: true };
}
