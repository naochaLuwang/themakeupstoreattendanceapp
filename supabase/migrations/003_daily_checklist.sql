-- Checklist Templates
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('opening', 'closing')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- Daily Checklists (one per day/type)
CREATE TABLE IF NOT EXISTS daily_checklists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES checklist_templates(id),
  type TEXT NOT NULL CHECK (type IN ('opening', 'closing')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'missed')),
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- Checklist Items (copied from template when checklist is started)
CREATE TABLE IF NOT EXISTS daily_checklist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  daily_checklist_id UUID NOT NULL REFERENCES daily_checklists(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  photo_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checklist_templates_type ON checklist_templates(type);
CREATE INDEX IF NOT EXISTS idx_daily_checklists_date ON daily_checklists(date);
CREATE INDEX IF NOT EXISTS idx_daily_checklists_type ON daily_checklists(type);
CREATE INDEX IF NOT EXISTS idx_daily_checklists_status ON daily_checklists(status);
CREATE INDEX IF NOT EXISTS idx_daily_checklist_items_checklist ON daily_checklist_items(daily_checklist_id);
CREATE INDEX IF NOT EXISTS idx_daily_checklist_items_status ON daily_checklist_items(daily_checklist_id, is_completed);

-- RLS
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_checklist_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view checklist templates" ON checklist_templates;
DROP POLICY IF EXISTS "Admin/Manager can manage templates" ON checklist_templates;
DROP POLICY IF EXISTS "Admin can delete templates" ON checklist_templates;
DROP POLICY IF EXISTS "Everyone can view daily checklists" ON daily_checklists;
DROP POLICY IF EXISTS "Authenticated users can create daily checklists" ON daily_checklists;
DROP POLICY IF EXISTS "Employees can update own checklists" ON daily_checklists;
DROP POLICY IF EXISTS "Admin can delete daily checklists" ON daily_checklists;
DROP POLICY IF EXISTS "Everyone can view checklist items" ON daily_checklist_items;
DROP POLICY IF EXISTS "Authenticated users can manage items" ON daily_checklist_items;

-- Templates policies
CREATE POLICY "Everyone can view checklist templates"
  ON checklist_templates FOR SELECT
  USING (true);

CREATE POLICY "Admin/Manager can manage templates"
  ON checklist_templates FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Admin/Manager can update templates"
  ON checklist_templates FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Admin can delete templates"
  ON checklist_templates FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Daily checklists policies
CREATE POLICY "Everyone can view daily checklists"
  ON daily_checklists FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create daily checklists"
  ON daily_checklists FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update own checklists"
  ON daily_checklists FOR UPDATE
  USING (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Admin can delete daily checklists"
  ON daily_checklists FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Checklist items policies
CREATE POLICY "Everyone can view checklist items"
  ON daily_checklist_items FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage items"
  ON daily_checklist_items FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can update items"
  ON daily_checklist_items FOR UPDATE
  USING (
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Admin can delete items"
  ON daily_checklist_items FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- updated_at trigger for all three tables
DROP TRIGGER IF EXISTS update_checklist_templates_updated_at ON checklist_templates;
CREATE TRIGGER update_checklist_templates_updated_at
  BEFORE UPDATE ON checklist_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_checklists_updated_at ON daily_checklists;
CREATE TRIGGER update_daily_checklists_updated_at
  BEFORE UPDATE ON daily_checklists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_daily_checklist_items_updated_at ON daily_checklist_items;
CREATE TRIGGER update_daily_checklist_items_updated_at
  BEFORE UPDATE ON daily_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
