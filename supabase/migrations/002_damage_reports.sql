-- Add manager role to profiles
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'employee'));

-- Damage Types
DO $$ BEGIN
  CREATE TYPE damage_type AS ENUM (
    'Broken',
    'Leaking',
    'Expired',
    'Packaging Damage',
    'Customer Damage',
    'Supplier Damage',
    'Missing Item',
    'Tester Finished'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE damage_report_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- damage_reports
CREATE TABLE IF NOT EXISTS damage_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  barcode TEXT NOT NULL,
  product_name TEXT NOT NULL,
  brand TEXT,
  shade TEXT,
  batch TEXT,
  mrp DECIMAL(10,2),
  quantity INTEGER NOT NULL DEFAULT 1,
  damage_type damage_type NOT NULL,
  description TEXT,
  reported_by UUID NOT NULL REFERENCES profiles(id),
  store_id UUID REFERENCES stores(id),
  status damage_report_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- damage_images
CREATE TABLE IF NOT EXISTS damage_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  damage_report_id UUID NOT NULL REFERENCES damage_reports(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- damage_comments
CREATE TABLE IF NOT EXISTS damage_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  damage_report_id UUID NOT NULL REFERENCES damage_reports(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES profiles(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_damage_reports_status ON damage_reports(status);
CREATE INDEX IF NOT EXISTS idx_damage_reports_reported_by ON damage_reports(reported_by);
CREATE INDEX IF NOT EXISTS idx_damage_reports_product_name ON damage_reports(product_name);
CREATE INDEX IF NOT EXISTS idx_damage_reports_barcode ON damage_reports(barcode);
CREATE INDEX IF NOT EXISTS idx_damage_reports_created_at ON damage_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_damage_images_report ON damage_images(damage_report_id);
CREATE INDEX IF NOT EXISTS idx_damage_comments_report ON damage_comments(damage_report_id);

-- RLS
ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Everyone can view damage reports" ON damage_reports;
DROP POLICY IF EXISTS "Employees can create damage reports" ON damage_reports;
DROP POLICY IF EXISTS "Admin/Manager can update damage reports" ON damage_reports;
DROP POLICY IF EXISTS "Admin can delete damage reports" ON damage_reports;
DROP POLICY IF EXISTS "Everyone can view damage images" ON damage_images;
DROP POLICY IF EXISTS "Authenticated users can add images" ON damage_images;
DROP POLICY IF EXISTS "Admin can delete images" ON damage_images;
DROP POLICY IF EXISTS "Everyone can view damage comments" ON damage_comments;
DROP POLICY IF EXISTS "Authenticated users can add comments" ON damage_comments;
DROP POLICY IF EXISTS "Admin can delete comments" ON damage_comments;

-- damage_reports policies
CREATE POLICY "Everyone can view damage reports"
  ON damage_reports FOR SELECT
  USING (true);

CREATE POLICY "Employees can create damage reports"
  ON damage_reports FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'employee'))
  );

CREATE POLICY "Admin/Manager can update damage reports"
  ON damage_reports FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "Admin can delete damage reports"
  ON damage_reports FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- damage_images policies
CREATE POLICY "Everyone can view damage images"
  ON damage_images FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add images"
  ON damage_images FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin can delete images"
  ON damage_images FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- damage_comments policies
CREATE POLICY "Everyone can view damage comments"
  ON damage_comments FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add comments"
  ON damage_comments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admin can delete comments"
  ON damage_comments FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_damage_reports_updated_at ON damage_reports;
CREATE TRIGGER update_damage_reports_updated_at
  BEFORE UPDATE ON damage_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
