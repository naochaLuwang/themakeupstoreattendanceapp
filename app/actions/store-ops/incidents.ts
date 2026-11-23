'use server'

import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/store-ops/permissions';

export async function createIncident(data: {
  title: string
  description?: string
  incident_type: string
  priority?: string
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

  if (!profile || !can(profile.role, 'incidents.create')) {
    return { error: 'Forbidden' };
  }

  const { data: incident, error } = await supabase
    .from('incidents')
    .insert({
      title: data.title,
      description: data.description || null,
      incident_type: data.incident_type,
      priority: data.priority || 'medium',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (data.image_urls && data.image_urls.length > 0) {
    const imageRows = data.image_urls.map(url => ({
      incident_id: incident.id,
      url,
      created_by: user.id,
    }));

    const { error: imgError } = await supabase
      .from('incident_images')
      .insert(imageRows);

    if (imgError) return { error: imgError.message };
  }

  return { success: true, data: incident };
}

export async function updateIncident(
  id: string,
  data: Partial<{
    title: string
    description: string
    incident_type: string
    priority: string
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

  if (!profile || !can(profile.role, 'incidents.edit')) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('incidents')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteIncident(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'incidents.delete')) {
    return { error: 'Forbidden' };
  }

  const { data: images } = await supabase
    .from('incident_images')
    .select('url')
    .eq('incident_id', id);

  if (images) {
    for (const img of images) {
      const path = img.url.split('/store-images/')[1];
      if (path) {
        await supabase.storage.from('store-images').remove([path]);
      }
    }
  }

  const { error } = await supabase
    .from('incidents')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function updateIncidentStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'incidents.change_status')) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('incidents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function assignIncident(id: string, assigneeId: string | null) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'incidents.assign')) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('incidents')
    .update({ assigned_to: assigneeId, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function addIncidentComment(incidentId: string, comment: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'incidents.add_comment')) {
    return { error: 'Forbidden' };
  }

  const { data, error } = await supabase
    .from('incident_comments')
    .insert({
      incident_id: incidentId,
      comment,
      created_by: user.id,
    })
    .select('*, profiles:created_by(full_name)')
    .single();

  if (error) return { error: error.message };
  return { success: true, data };
}

export async function uploadIncidentImage(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };

  const ext = file.name.split('.').pop();
  const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('store-images')
    .upload(`incidents/${fileName}`, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from('store-images')
    .getPublicUrl(`incidents/${fileName}`);

  return { success: true, url: publicUrl };
}

export async function deleteIncidentImage(imageId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: image } = await supabase
    .from('incident_images')
    .select('url')
    .eq('id', imageId)
    .single();

  if (!image) return { error: 'Image not found' };

  const path = image.url.split('/store-images/')[1];
  if (path) {
    await supabase.storage.from('store-images').remove([path]);
  }

  const { error } = await supabase
    .from('incident_images')
    .delete()
    .eq('id', imageId);

  if (error) return { error: error.message };
  return { success: true };
}
