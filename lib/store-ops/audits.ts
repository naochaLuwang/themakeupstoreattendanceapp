import { createClient } from '@/lib/supabase/server';
import type { AuditWithRelations, AuditTemplateWithQuestions, AuditFilters } from './types';

export async function getAuditTemplates() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('audit_templates')
    .select(`
      *,
      audit_questions(*, profiles:created_by(full_name)),
      profiles:created_by(full_name)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as AuditTemplateWithQuestions[];
}

export async function getAuditTemplateWithQuestions(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('audit_templates')
    .select(`
      *,
      audit_questions(*, profiles:created_by(full_name)),
      profiles:created_by(full_name)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as AuditTemplateWithQuestions;
}

export async function getAudits(filters: AuditFilters = {}) {
  const supabase = await createClient();
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('audits')
    .select(`
      *,
      audit_templates(name, category),
      profiles:conducted_by(full_name)
    `, { count: 'exact' });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.category) {
    query = query.eq('audit_templates.category', filters.category);
  }

  if (filters.search) {
    query = query.ilike('audit_templates.name', `%${filters.search}%`);
  }

  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    data: (data || []) as unknown as AuditWithRelations[],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function getAuditById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('audits')
    .select(`
      *,
      audit_templates(name, category),
      audit_answers(
        *,
        audit_questions(question, max_score)
      ),
      profiles:conducted_by(full_name)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as AuditWithRelations;
}
