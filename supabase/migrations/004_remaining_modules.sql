-- ============================================================
-- MODULE 1: SHELF INSPECTION
-- ============================================================

CREATE TABLE IF NOT EXISTS store_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS shelf_inspections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES store_sections(id),
  employee_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'good' CHECK (status IN ('good','needs_restock','dirty','wrong_display','missing_tester','missing_price_tag','damaged_display')),
  notes TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS inspection_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL REFERENCES shelf_inspections(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS inspection_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inspection_id UUID NOT NULL REFERENCES shelf_inspections(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- ============================================================
-- MODULE 3: TESTER MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS testers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_name TEXT NOT NULL,
  brand TEXT,
  shade TEXT,
  opened_date DATE,
  expiry_date DATE,
  condition TEXT DEFAULT 'good' CHECK (condition IN ('good','fair','poor','finished')),
  remaining_percentage INTEGER DEFAULT 100 CHECK (remaining_percentage >= 0 AND remaining_percentage <= 100),
  needs_replacement BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS tester_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tester_id UUID NOT NULL REFERENCES testers(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- ============================================================
-- MODULE 5: TASK MANAGEMENT
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES profiles(id),
  assigned_by UUID REFERENCES profiles(id),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  due_date TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  category TEXT CHECK (category IN ('restock','cleaning','inventory','maintenance','promotion','general')),
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS task_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- ============================================================
-- MODULE 6: STORE AUDITS
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('display','cleanliness','staff','lighting','product_placement','price_tags','promotions','safety')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS audit_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES audit_templates(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  max_score INTEGER DEFAULT 5,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES audit_templates(id),
  store_id UUID REFERENCES stores(id),
  conducted_by UUID NOT NULL REFERENCES profiles(id),
  final_score DECIMAL(5,2),
  max_score DECIMAL(5,2),
  notes TEXT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS audit_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES audit_questions(id),
  score INTEGER DEFAULT 0,
  comment TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- ============================================================
-- MODULE 7: INCIDENT REPORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  incident_type TEXT NOT NULL CHECK (incident_type IN ('customer_complaint','power_failure','internet_down','theft','broken_fixture','emergency','medical','other')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  assigned_to UUID REFERENCES profiles(id),
  store_id UUID REFERENCES stores(id),
  voice_note_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS incident_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS incident_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- ============================================================
-- MODULE 8: RESTOCKING
-- ============================================================

CREATE TABLE IF NOT EXISTS restock_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  notes TEXT,
  supplier_notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS restock_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restock_request_id UUID NOT NULL REFERENCES restock_requests(id) ON DELETE CASCADE,
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand TEXT,
  quantity_needed INTEGER NOT NULL DEFAULT 1,
  quantity_approved INTEGER,
  supplier_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- ============================================================
-- MODULE 9: NOTIFICATIONS LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  body TEXT,
  type TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Existing installations may already have the earlier table definitions.
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE audit_answers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- INDEXES
-- ============================================================

-- Shelf Inspection
CREATE INDEX IF NOT EXISTS idx_shelf_inspections_section ON shelf_inspections(section_id);
CREATE INDEX IF NOT EXISTS idx_shelf_inspections_employee ON shelf_inspections(employee_id);
CREATE INDEX IF NOT EXISTS idx_shelf_inspections_status ON shelf_inspections(status);
CREATE INDEX IF NOT EXISTS idx_shelf_inspections_created ON shelf_inspections(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspection_images_inspection ON inspection_images(inspection_id);
CREATE INDEX IF NOT EXISTS idx_inspection_comments_inspection ON inspection_comments(inspection_id);

-- Testers
CREATE INDEX IF NOT EXISTS idx_testers_expiry ON testers(expiry_date);
CREATE INDEX IF NOT EXISTS idx_testers_needs_replacement ON testers(needs_replacement);
CREATE INDEX IF NOT EXISTS idx_tester_logs_tester ON tester_logs(tester_id);

-- Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);

-- Audits
CREATE INDEX IF NOT EXISTS idx_audit_templates_category ON audit_templates(category);
CREATE INDEX IF NOT EXISTS idx_audit_questions_template ON audit_questions(template_id);
CREATE INDEX IF NOT EXISTS idx_audits_template ON audits(template_id);
CREATE INDEX IF NOT EXISTS idx_audits_conducted_by ON audits(conducted_by);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audit_answers_audit ON audit_answers(audit_id);

-- Incidents
CREATE INDEX IF NOT EXISTS idx_incidents_type ON incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_incidents_priority ON incidents(priority);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned ON incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incident_images_incident ON incident_images(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_comments_incident ON incident_comments(incident_id);

-- Restocking
CREATE INDEX IF NOT EXISTS idx_restock_requests_status ON restock_requests(status);
CREATE INDEX IF NOT EXISTS idx_restock_items_request ON restock_items(restock_request_id);
CREATE INDEX IF NOT EXISTS idx_restock_items_barcode ON restock_items(barcode);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_read ON notification_log(is_read);
CREATE INDEX IF NOT EXISTS idx_notification_log_created ON notification_log(created_at DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE store_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE shelf_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE tester_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE restock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES (All tables: everyone can SELECT, authenticated can INSERT,
-- creators/admins can UPDATE, admins can DELETE)
-- ============================================================

DO $$ DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'store_sections', 'shelf_inspections', 'inspection_images', 'inspection_comments',
    'testers', 'tester_logs',
    'tasks', 'task_comments', 'task_attachments',
    'audit_templates', 'audit_questions', 'audits', 'audit_answers',
    'incidents', 'incident_images', 'incident_comments',
    'restock_requests', 'restock_items',
    'notification_log'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Everyone can view %s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Everyone can view %s" ON %I FOR SELECT USING (true)', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "Auth users can insert %s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Auth users can insert %s" ON %I FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid()))', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "Owners can update %s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Owners can update %s" ON %I FOR UPDATE USING (auth.uid() = created_by OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN (''admin'', ''manager'')))', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "Admin can delete %s" ON %I', tbl, tbl);
    EXECUTE format('CREATE POLICY "Admin can delete %s" ON %I FOR DELETE USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ''admin''))', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

DO $$ DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'store_sections', 'shelf_inspections',
    'testers',
    'tasks',
    'audit_templates', 'audit_questions', 'audits', 'audit_answers',
    'incidents',
    'restock_requests'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', tbl, tbl);
  END LOOP;
END $$;
