'use server'

import { createClient } from '@/lib/supabase/server';
import { can, canManageApprovals, canDelete } from '@/lib/store-ops/permissions';

interface CreateItem {
  barcode: string
  product_name: string
  brand?: string
  quantity_needed: number
}

export async function createRestockRequest(items: CreateItem[], notes?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'restock.create')) {
    return { error: 'Forbidden' };
  }

  if (!items.length) return { error: 'At least one item is required' };

  const { data: request, error: reqError } = await supabase
    .from('restock_requests')
    .insert({
      notes: notes || null,
      status: 'pending',
      created_by: user.id,
    })
    .select()
    .single();

  if (reqError) return { error: reqError.message };

  const itemRows = items.map(item => ({
    restock_request_id: request.id,
    barcode: item.barcode,
    product_name: item.product_name,
    brand: item.brand || null,
    quantity_needed: item.quantity_needed,
    created_by: user.id,
  }));

  const { error: itemError } = await supabase
    .from('restock_items')
    .insert(itemRows);

  if (itemError) return { error: itemError.message };

  return { success: true, data: request };
}

export async function approveRestockRequest(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'restock.approve')) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('restock_requests')
    .update({
      status: 'approved',
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function rejectRestockRequest(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'restock.reject')) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('restock_requests')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function completeRestockRequest(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'restock.complete')) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('restock_requests')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteRestockRequest(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !canDelete(profile.role as any)) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('restock_requests')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}
