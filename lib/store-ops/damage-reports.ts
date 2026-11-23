import { createClient } from '@/lib/supabase/server';
import type { DamageReportWithRelations, DamageReportFilters } from './types';

export async function getDamageReports(filters: DamageReportFilters = {}) {
  const supabase = await createClient();
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('damage_reports')
    .select(`
      *,
      profiles:reported_by(full_name, email),
      damage_images(*),
      damage_comments(*, profiles:created_by(full_name))
    `, { count: 'exact' });

  if (filters.search) {
    query = query.or(
      `product_name.ilike.%${filters.search}%,barcode.ilike.%${filters.search}%,brand.ilike.%${filters.search}%`
    );
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.damage_type) {
    query = query.eq('damage_type', filters.damage_type);
  }

  if (filters.dateFrom) {
    query = query.gte('created_at', filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte('created_at', filters.dateTo);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: (data || []) as unknown as DamageReportWithRelations[],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function getDamageReportById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('damage_reports')
    .select(`
      *,
      profiles:reported_by(full_name, email),
      damage_images(*),
      damage_comments(*, profiles:created_by(full_name))
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as DamageReportWithRelations;
}
