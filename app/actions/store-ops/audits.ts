'use server'

import { createClient } from '@/lib/supabase/server';

export async function createAuditTemplate(data: {
  name: string
  category: string
  questions: { question: string; max_score: number }[]
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
    .from('audit_templates')
    .insert({
      name: data.name,
      category: data.category || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  if (data.questions.length > 0) {
    const { error: qError } = await supabase
      .from('audit_questions')
      .insert(
        data.questions.map((q, i) => ({
          template_id: template.id,
          question: q.question,
          max_score: q.max_score,
          sort_order: i,
          created_by: user.id,
        }))
      );

    if (qError) return { error: qError.message };
  }

  return { success: true, data: template };
}

export async function deleteAuditTemplate(id: string) {
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
    .from('audit_templates')
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function startAudit(templateId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: template } = await supabase
    .from('audit_templates')
    .select('id')
    .eq('id', templateId)
    .single();

  if (!template) return { error: 'Template not found' };

  const { data: questions } = await supabase
    .from('audit_questions')
    .select('id, max_score')
    .eq('template_id', templateId)
    .order('sort_order');

  if (!questions || questions.length === 0) return { error: 'Template has no questions' };

  const totalMax = questions.reduce((sum, q) => sum + q.max_score, 0);

  const { data: audit, error } = await supabase
    .from('audits')
    .insert({
      template_id: templateId,
      conducted_by: user.id,
      max_score: totalMax,
      status: 'in_progress',
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  const { error: aError } = await supabase
    .from('audit_answers')
    .insert(
      questions.map(q => ({
        audit_id: audit.id,
        question_id: q.id,
        score: 0,
        created_by: user.id,
      }))
    );

  if (aError) return { error: aError.message };

  return { success: true, data: audit };
}

export async function submitAuditAnswer(
  auditId: string,
  questionId: string,
  score: number,
  comment?: string,
  photoUrl?: string
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('audit_answers')
    .update({
      score,
      comment: comment || null,
      photo_url: photoUrl || null,
    })
    .eq('audit_id', auditId)
    .eq('question_id', questionId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function completeAudit(auditId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: answers } = await supabase
    .from('audit_answers')
    .select('score')
    .eq('audit_id', auditId);

  if (!answers) return { error: 'No answers found' };

  const totalScore = answers.reduce((sum, a) => sum + a.score, 0);

  const { data: audit } = await supabase
    .from('audits')
    .select('max_score')
    .eq('id', auditId)
    .single();

  if (!audit) return { error: 'Audit not found' };

  const { error } = await supabase
    .from('audits')
    .update({
      final_score: totalScore,
      status: 'completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', auditId);

  if (error) return { error: error.message };
  return { success: true, data: { final_score: totalScore, max_score: audit.max_score } };
}

export async function uploadAuditImage(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const file = formData.get('file') as File;
  if (!file) return { error: 'No file provided' };

  const ext = file.name.split('.').pop();
  const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('store-images')
    .upload(`audits/${fileName}`, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) return { error: uploadError.message };

  const { data: { publicUrl } } = supabase.storage
    .from('store-images')
    .getPublicUrl(`audits/${fileName}`);

  return { success: true, url: publicUrl };
}
