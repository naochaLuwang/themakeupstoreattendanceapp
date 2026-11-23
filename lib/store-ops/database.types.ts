// Store Operations - Extended Database Types (not auto-generated)

export interface StoreSection {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  created_by: string
}

export interface ShelfInspection {
  id: string
  section_id: string
  employee_id: string
  status: string
  notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  created_by: string
}

export interface InspectionImage {
  id: string
  inspection_id: string
  url: string
  created_at: string
  created_by: string
}

export interface InspectionComment {
  id: string
  inspection_id: string
  comment: string
  created_at: string
  created_by: string
}

export interface Tester {
  id: string
  product_name: string
  brand: string | null
  shade: string | null
  opened_date: string | null
  expiry_date: string | null
  condition: string
  remaining_percentage: number
  needs_replacement: boolean
  created_at: string
  updated_at: string
  created_by: string
}

export interface TesterLog {
  id: string
  tester_id: string
  action: string
  notes: string | null
  created_at: string
  created_by: string
}

export interface Task {
  id: string
  title: string
  description: string | null
  assigned_to: string | null
  assigned_by: string | null
  priority: string
  due_date: string | null
  status: string
  category: string | null
  is_recurring: boolean
  recurrence_rule: string | null
  created_at: string
  updated_at: string
  created_by: string
}

export interface TaskComment {
  id: string
  task_id: string
  comment: string
  created_at: string
  created_by: string
}

export interface TaskAttachment {
  id: string
  task_id: string
  url: string
  created_at: string
  created_by: string
}

export interface AuditTemplate {
  id: string
  name: string
  category: string | null
  created_at: string
  updated_at: string
  created_by: string
}

export interface AuditQuestion {
  id: string
  template_id: string
  question: string
  max_score: number
  sort_order: number
  created_at: string
  created_by: string
}

export interface Audit {
  id: string
  template_id: string
  store_id: string | null
  conducted_by: string
  final_score: number | null
  max_score: number | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string
  created_by: string
}

export interface AuditAnswer {
  id: string
  audit_id: string
  question_id: string
  score: number
  comment: string | null
  photo_url: string | null
  created_at: string
  created_by: string
}

export interface Incident {
  id: string
  title: string
  description: string | null
  incident_type: string
  priority: string
  status: string
  assigned_to: string | null
  store_id: string | null
  voice_note_url: string | null
  created_at: string
  updated_at: string
  created_by: string
}

export interface IncidentImage {
  id: string
  incident_id: string
  url: string
  created_at: string
  created_by: string
}

export interface IncidentComment {
  id: string
  incident_id: string
  comment: string
  created_at: string
  created_by: string
}

export interface RestockRequest {
  id: string
  status: string
  notes: string | null
  supplier_notes: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  created_by: string
}

export interface RestockItem {
  id: string
  restock_request_id: string
  barcode: string
  product_name: string
  brand: string | null
  quantity_needed: number
  quantity_approved: number | null
  supplier_notes: string | null
  created_at: string
  created_by: string
}

export interface NotificationLog {
  id: string
  user_id: string | null
  title: string
  body: string | null
  type: string | null
  link: string | null
  is_read: boolean
  created_at: string
}
