import type { Database } from '@/lib/supabase/database.types';
import type { ShelfInspection, InspectionImage, InspectionComment, Task, TaskComment, TaskAttachment, RestockRequest, RestockItem, Incident, IncidentImage, IncidentComment, AuditTemplate, AuditQuestion, Audit, AuditAnswer, Tester, TesterLog } from './database.types';

type DamageReport = Database['public']['Tables']['damage_reports']['Row'];
type DamageImage = Database['public']['Tables']['damage_images']['Row'];
type DamageComment = Database['public']['Tables']['damage_comments']['Row'];

export type DamageReportWithRelations = DamageReport & {
  profiles: { full_name: string | null; email: string } | null;
  damage_images: DamageImage[];
  damage_comments: (DamageComment & { profiles: { full_name: string | null } | null })[];
};

export type ShelfInspectionWithRelations = ShelfInspection & {
  store_sections: { name: string; description: string | null } | null;
  profiles: { full_name: string | null; email: string } | null;
  inspection_images: InspectionImage[];
  inspection_comments: (InspectionComment & { profiles: { full_name: string | null } | null })[];
};

export interface ShelfInspectionFilters {
  search?: string;
  status?: string;
  section_id?: string;
  page?: number;
  limit?: number;
}

export interface DamageReportFilters {
  search?: string;
  status?: string;
  damage_type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// Tester types
export type TesterWithRelations = Tester & {
  profiles: { full_name: string | null } | null;
  tester_logs: (TesterLog & { profiles: { full_name: string | null } | null })[];
};

export interface TesterFilters {
  search?: string;
  condition?: string;
  needs_replacement?: boolean;
  sort_by?: 'expiry_date' | 'created_at' | 'product_name';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface AuditTemplateWithQuestions extends AuditTemplate {
  audit_questions: (AuditQuestion & { profiles?: { full_name: string | null } | null })[];
  profiles?: { full_name: string | null } | null;
}

export interface AuditWithRelations extends Audit {
  audit_templates: { name: string; category: string | null } | null;
  audit_answers: (AuditAnswer & { audit_questions: { question: string; max_score: number } | null })[];
  profiles?: { full_name: string | null } | null;
}

export interface AuditFilters {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export type TaskWithRelations = Task & {
  assigned_to_profile: { full_name: string | null } | null;
  assigned_by_profile: { full_name: string | null } | null;
  task_comments: (TaskComment & { profiles: { full_name: string | null } | null })[];
  task_attachments: TaskAttachment[];
};

export interface TaskFilters {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  assigned_to?: string;
  page?: number;
  limit?: number;
}

export type RestockRequestWithRelations = RestockRequest & {
  profiles: { full_name: string | null } | null;
  restock_items: RestockItem[];
};

export interface RestockFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export type IncidentWithRelations = Incident & {
  profiles: { full_name: string | null; email: string } | null;
  assigned_to_profile: { full_name: string | null } | null;
  incident_images: IncidentImage[];
  incident_comments: (IncidentComment & { profiles: { full_name: string | null } | null })[];
};

export interface IncidentFilters {
  search?: string;
  status?: string;
  incident_type?: string;
  priority?: string;
  page?: number;
  limit?: number;
}
