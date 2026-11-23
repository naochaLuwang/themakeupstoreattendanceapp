'use server'

import { createClient } from '@/lib/supabase/server';
import { can, canDelete } from '@/lib/store-ops/permissions';

export async function createTester(data: {
  product_name: string
  brand?: string
  shade?: string
  opened_date?: string
  expiry_date?: string
  condition: string
  remaining_percentage: number
}) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'testers.create')) {
    return { error: 'Forbidden' };
  }

  const { data: tester, error } = await supabase
    .from('testers')
    .insert({
      product_name: data.product_name,
      brand: data.brand || null,
      shade: data.shade || null,
      opened_date: data.opened_date || null,
      expiry_date: data.expiry_date || null,
      condition: data.condition,
      remaining_percentage: data.remaining_percentage,
      needs_replacement: data.remaining_percentage <= 10 || data.condition === 'finished',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  await logTesterAction(tester.id, 'created', 'Tester created');

  return { success: true, data: tester };
}

export async function updateTester(
  id: string,
  data: Partial<{
    product_name: string
    brand: string
    shade: string
    opened_date: string
    expiry_date: string
    condition: string
    remaining_percentage: number
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

  if (!profile || !can(profile.role, 'testers.edit')) {
    return { error: 'Forbidden' };
  }

  const needs_replacement = data.remaining_percentage !== undefined
    ? data.remaining_percentage <= 10
    : data.condition === 'finished'
    ? true
    : undefined;

  const { error } = await supabase
    .from('testers')
    .update({
      ...data,
      ...(needs_replacement !== undefined && { needs_replacement }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };

  await logTesterAction(id, 'updated', 'Tester details updated');

  return { success: true };
}

export async function deleteTester(id: string) {
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
    .from('testers')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function logTesterAction(testerId: string, action: string, notes?: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data, error } = await supabase
    .from('tester_logs')
    .insert({
      tester_id: testerId,
      action,
      notes: notes || null,
      created_by: user.id,
    })
    .select('*, profiles:created_by(full_name)')
    .single();

  if (error) return { error: error.message };
  return { success: true, data };
}

export async function markNeedsReplacement(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'testers.edit')) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('testers')
    .update({ needs_replacement: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };

  await logTesterAction(id, 'marked_for_replacement', 'Marked as needs replacement');

  return { success: true };
}

export async function updateTesterCondition(id: string, condition: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'testers.edit')) {
    return { error: 'Forbidden' };
  }

  const { error } = await supabase
    .from('testers')
    .update({
      condition,
      ...(condition === 'finished' && { needs_replacement: true, remaining_percentage: 0 }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return { error: error.message };

  await logTesterAction(id, 'condition_updated', `Condition changed to ${condition}`);

  return { success: true };
}
