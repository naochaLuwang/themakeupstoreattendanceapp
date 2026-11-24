"""Isolated PostgreSQL evidence. Never reads .env or connects to Supabase.
Requires the temporary local cluster described in report.txt. Uses fictional UUIDs.
"""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[3]
PSQL = ['/opt/homebrew/opt/postgresql@17/bin/psql', '-X', '-q', '-A', '-t', '-h', '/private/tmp', '-p', '55439', '-U', 'audit_owner', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
results = []

def sql(statement, expect_error=None):
    result = subprocess.run(PSQL + ['-c', statement], capture_output=True, text=True)
    if expect_error:
        assert result.returncode and expect_error in result.stderr, result.stderr
        return result.stderr.strip()
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()

def record(name, evidence):
    results.append({'check': name, 'evidence': evidence})

sql("""
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE TABLE profiles (id uuid PRIMARY KEY, role text, store_id uuid, full_name text);
CREATE TABLE stores (id uuid PRIMARY KEY);
INSERT INTO profiles(id,role) VALUES
('00000000-0000-4000-8000-000000000001','employee'),
('00000000-0000-4000-8000-000000000002','employee'),
('00000000-0000-4000-8000-000000000003','manager');
""")

for migration in ['002_damage_reports.sql', '003_daily_checklist.sql']:
    result = subprocess.run(PSQL + ['-f', str(ROOT / 'supabase/migrations' / migration)], capture_output=True, text=True)
    assert result.returncode == 0, result.stderr
    record('migration applies with minimal base schema: ' + migration, 'success')

result = subprocess.run(PSQL + ['-f', str(ROOT / 'supabase/migrations/004_remaining_modules.sql')], capture_output=True, text=True)
assert result.returncode and 'column "created_by" does not exist' in result.stderr, result.stderr
record('004 fails while creating notification_log UPDATE policy', result.stderr[result.stderr.rfind('ERROR:'):].strip())
record('004 policy DO block rollback leaves tasks with no policies on this clean fixture', sql("SELECT count(*) FROM pg_policies WHERE tablename='tasks'"))

sql("""
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
GRANT SELECT ON profiles TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
INSERT INTO checklist_templates(id,name,type,created_by) VALUES ('00000000-0000-4000-8000-000000000010','Fixture','opening','00000000-0000-4000-8000-000000000003');
""")
record('template item FK rejects a checklist_templates ID', sql("""
INSERT INTO daily_checklist_items(daily_checklist_id,label,created_by) VALUES
('00000000-0000-4000-8000-000000000010','Unlock','00000000-0000-4000-8000-000000000003');
""", 'violates foreign key constraint'))

sql("""
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
INSERT INTO damage_reports(barcode,product_name,damage_type,quantity,mrp,status,reported_by,created_by,reviewed_by)
VALUES ('fixture','Fixture','Broken',-5,-100,'approved','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003');
""")
record('002 employee INSERT policy accepts preapproved report, forged author and negative amount/quantity', sql("SELECT status||','||quantity||','||mrp||','||created_by FROM damage_reports WHERE barcode='fixture'"))
record('002 anonymous SELECT policy exposes rows IF table SELECT privileges exist', sql("SET ROLE anon; SELECT count(*) FROM damage_reports WHERE barcode='fixture'"))

sql("""
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
INSERT INTO daily_checklists(template_id,type,date,status,created_by) VALUES
('00000000-0000-4000-8000-000000000010','opening','2026-11-24','completed','00000000-0000-4000-8000-000000000002'),
('00000000-0000-4000-8000-000000000010','opening','2026-11-24','completed','00000000-0000-4000-8000-000000000002');
""")
record('003 employee can INSERT completed, author-forged duplicate daily checklists with no items', sql("SELECT count(*) FROM daily_checklists WHERE date='2026-11-24' AND type='opening' AND status='completed'"))

result = subprocess.run(PSQL + ['-f', str(ROOT / 'supabase/migrations/003_daily_checklist.sql')], capture_output=True, text=True)
assert result.returncode and 'already exists' in result.stderr, result.stderr
record('003 rerun fails because DROP policy names do not match CREATE names', result.stderr[result.stderr.rfind('ERROR:'):].strip())

# Evaluate the intended generic policies separately. The original full DO block
# failed above; removing notification_log from a TEMPORARY STRING is explicit.
# This is not evidence these policies exist in production or apply unmodified.
source = (ROOT / 'supabase/migrations/004_remaining_modules.sql').read_text()
start = source.index('DO $$ DECLARE')
end = source.index('END $$;', start) + len('END $$;')
policy_fixture = source[start:end].replace(",\n    'notification_log'", '')
assert policy_fixture != source[start:end]
sql(policy_fixture)
sql("""
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
INSERT INTO tasks(id,title,status,created_by,assigned_to) VALUES
('00000000-0000-4000-8000-000000000011','Employee-created task','completed','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
INSERT INTO restock_requests(id,status,approved_by,created_by) VALUES
('00000000-0000-4000-8000-000000000012','pending',null,'00000000-0000-4000-8000-000000000001');
UPDATE restock_requests SET status='approved',approved_by='00000000-0000-4000-8000-000000000003' WHERE id='00000000-0000-4000-8000-000000000012';
""")
record('004 intended policies in adjusted fixture let employee create/assign completed task and self-approve own restock', sql("SELECT status FROM restock_requests WHERE id='00000000-0000-4000-8000-000000000012'"))
record('004 adjusted fixture has no store boundary on incident SELECT', sql("SELECT qual FROM pg_policies WHERE tablename='incidents' AND cmd='SELECT'"))

path = Path(__file__).with_name('database-reproductions.json')
path.write_text(json.dumps({'environment':'Isolated PostgreSQL 17; minimal fictional base schema; no production access; explicit anon/authenticated grants assumed for permission tests', 'checks':results}, indent=2) + '\n')
print(json.dumps({'checks':len(results),'output':str(path)}, indent=2))
