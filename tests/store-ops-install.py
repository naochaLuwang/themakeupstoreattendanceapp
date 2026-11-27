"""Regression coverage for SQL Editor installation with missing base migrations."""
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True
from store_ops_fixture import database
from attendance_fixture import EMP, STORE

ROOT = Path(__file__).resolve().parents[1]
subprocess.run(['node', 'scripts/build-store-operations-sql.mjs'], cwd=ROOT, check=True)
bundle = (ROOT/'supabase/deployment/store_operations_install.sql').read_text()
security = (ROOT/'supabase/migrations/20261125132304_store_operations_security.sql').read_text()
# Recovery fixtures start before the first operations repair. Later additive
# migrations depend on that repair and cannot be included in the baseline.
baseline = [path.name for path in sorted((ROOT/'supabase/migrations').glob('*.sql')) if path.name < '20261125132304_store_operations_security.sql']
without_checklists = [name for name in baseline if name != '003_daily_checklist.sql']

with database(without_checklists) as sql:
    assert sql("SELECT to_regclass('public.checklist_templates') IS NULL") == 't'
    sql(security, error='Store Operations base migrations are missing')
    assert sql("SELECT to_regnamespace('store_ops_private') IS NULL") == 't'
    print('PASS missing checklist base tables fail before any repair changes, with prerequisite instructions', flush=True)
    original = sql(f"INSERT INTO damage_reports(barcode,product_name,damage_type,reported_by,created_by) VALUES('123','Existing report','Broken','{EMP}','{EMP}') RETURNING id")
    sql(bundle)
    assert sql("SELECT to_regclass('public.checklist_templates') IS NOT NULL AND to_regclass('public.daily_checklist_items') IS NOT NULL AND to_regclass('public.checklist_template_items') IS NOT NULL") == 't'
    assert sql(f"SELECT store_id FROM damage_reports WHERE id='{original}'") == STORE
    assert sql("SELECT to_regprocedure('public.store_ops_report(date,date,uuid)') IS NOT NULL") == 't'
    assert sql("SELECT public IS FALSE FROM storage.buckets WHERE id='store-images'") == 't'
    sql('SELECT * FROM checklist_templates', role='anon', error='permission denied')
    print('PASS ordered SQL Editor bundle repairs a database missing migration 003 and preserves existing data', flush=True)
    sql(bundle, error='already installed or partially installed')
    assert sql(f"SELECT count(*) FROM damage_reports WHERE id='{original}'") == '1'
    print('PASS repeat installation stops before changing an already repaired database', flush=True)

with database(baseline) as sql:
    sql((ROOT/'supabase/migrations/003_daily_checklist.sql').read_text())
    sql(bundle)
    assert sql("SELECT to_regclass('public.store_operation_events') IS NOT NULL") == 't'
    print('PASS existing complete base schema and repeat checklist setup install successfully', flush=True)

attendance_only = [name for name in baseline if name not in {'002_damage_reports.sql', '003_daily_checklist.sql', '004_remaining_modules.sql'}]
with database(attendance_only) as sql:
    assert sql("SELECT to_regclass('public.damage_reports') IS NULL") == 't'
    sql(bundle)
    assert sql("SELECT to_regclass('public.checklist_templates') IS NOT NULL AND to_regclass('public.store_operation_events') IS NOT NULL") == 't'
    print('PASS existing attendance installation can initialize all missing operations base tables', flush=True)

with database(without_checklists) as sql:
    sql('ALTER TABLE damage_reports ADD CONSTRAINT damage_quantity_positive CHECK(quantity>0)')
    sql(bundle, error='already exists')
    assert sql("SELECT to_regclass('public.checklist_templates') IS NULL") == 't'
    assert sql("SELECT to_regnamespace('store_ops_private') IS NULL") == 't'
    print('PASS a later migration failure rolls back the whole bundle, including base tables and security changes', flush=True)
