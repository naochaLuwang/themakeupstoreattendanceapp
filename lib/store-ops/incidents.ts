import { createClient } from '@/lib/supabase/server';
import type { IncidentWithRelations, IncidentFilters } from './types';

export async function getIncidents(filters: IncidentFilters = {}) {
  const supabase = await createClient();
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('incidents')
    .select(`
      *,
      profiles:created_by(full_name, email),
      assigned_to_profile:assigned_to(full_name),
      incident_images(*),
      incident_comments(*, profiles:created_by(full_name))
    `, { count: 'exact' });

  if (filters.search) {
    query = query.or(
      `title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.incident_type) {
    query = query.eq('incident_type', filters.incident_type);
  }

  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: (data || []) as unknown as IncidentWithRelations[],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function getIncidentById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('incidents')
    .select(`
      *,
      profiles:created_by(full_name, email),
      assigned_to_profile:assigned_to(full_name),
      incident_images(*),
      incident_comments(*, profiles:created_by(full_name))
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as IncidentWithRelations;
}
