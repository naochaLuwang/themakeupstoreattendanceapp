"""Reproduce Store Operations review findings using a disposable local PostgreSQL cluster.

No environment files, credentials, hosted databases, or application data are used.
Run from the repository root: python3 output/verification/store-operations/review-database.py
"""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[3]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'tests'))
from attendance_fixture import BASE_SCHEMA, EMP, ADMIN, MANAGER, OTHER, FOREIGN

BIN = Path('/opt/homebrew/opt/postgresql@17/bin')
cluster = Path(tempfile.mkdtemp(prefix='store-ops-review-', dir='/private/tmp'))
connection = ['-h', str(cluster), '-p', '55447', '-U', 'store_ops_review', '-d', 'postgres']
checks = []
started = False


def command(name, *args):
    return subprocess.run([str(BIN / name), *args], capture_output=True, text=True)


def sql(statement, actor=None, role='authenticated', expected_error=None):
    if actor:
        statement = f"SET ROLE {role}; SELECT set_config('request.jwt.claim.sub','{actor}',false); " + statement
    elif role == 'anon':
        statement = 'SET ROLE anon; ' + statement
    result = command('psql', '-X', '-qAt', *connection, '-v', 'ON_ERROR_STOP=1', '-c', statement)
    if expected_error:
        assert result.returncode != 0 and expected_error in result.stderr, result.stderr
        return result.stderr.strip()
    assert result.returncode == 0, result.stderr
    return result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ''


def record(name, evidence):
    checks.append({'finding': name, 'evidence': evidence})
    print('CONFIRMED:', name, flush=True)


try:
    result = command('initdb', '-D', str(cluster / 'data'), '-A', 'trust', '-U', 'store_ops_review', '--no-locale', '-E', 'UTF8')
    assert result.returncode == 0, result.stderr
    result = command('pg_ctl', '-D', str(cluster / 'data'), '-l', str(cluster / 'server.log'), '-o', f"-h '' -k {cluster} -p 55447 -c wal_level=logical", '-w', 'start')
    assert result.returncode == 0, result.stderr + result.stdout
    started = True
    sql('CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;')
    sql(BASE_SCHEMA)
    sql('CREATE PUBLICATION supabase_realtime;')
    for migration in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
        result = command('psql', '-X', '-qAt', *connection, '-v', 'ON_ERROR_STOP=1', '-f', str(migration))
        if migration.name == '004_remaining_modules.sql' and result.returncode:
            assert 'column "created_by" does not exist' in result.stderr, result.stderr[-1800:]
            record('Migration 004 fails on a clean install: notification_log has no created_by column required by its UPDATE policy', result.stderr[result.stderr.rfind('ERROR:'):].strip())
            # Test-only prerequisite supplied by the later reminder migration.
            # This is never applied to application source or a hosted database.
            sql('ALTER TABLE notification_log ADD COLUMN created_by uuid;')
            result = command('psql', '-X', '-qAt', *connection, '-v', 'ON_ERROR_STOP=1', '-f', str(migration))
        assert result.returncode == 0, f'{migration.name}: {result.stderr[-1800:]}'
    # Simulate exposed Data API tables; these grants are explicit, so anonymous
    # read findings are conditional on matching grants in the hosted project.
    sql('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated; GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;')

    template = sql(f"INSERT INTO checklist_templates(name,type,created_by) VALUES('Opening','opening','{MANAGER}') RETURNING id", actor=MANAGER)
    error = sql(f"INSERT INTO daily_checklist_items(daily_checklist_id,label,created_by) VALUES('{template}','Unlock store','{MANAGER}')", actor=MANAGER, expected_error='daily_checklist_items_daily_checklist_id_fkey')
    assert sql(f"SELECT count(*) FROM checklist_templates WHERE id='{template}'") == '1'
    record('Checklist template items reference daily checklist IDs, so template creation fails after saving its header', error)

    task = sql(f"INSERT INTO tasks(title,assigned_to,assigned_by,created_by) VALUES('Clean display','{EMP}','{MANAGER}','{MANAGER}') RETURNING id", actor=MANAGER)
    updated = sql(f"WITH changed AS (UPDATE tasks SET status='completed' WHERE id='{task}' RETURNING id) SELECT count(*) FROM changed", actor=EMP)
    assert updated == '0' and sql(f"SELECT status FROM tasks WHERE id='{task}'") == 'pending'
    record('Employee cannot complete a task assigned by a manager; the update silently affects zero rows', {'updated_rows': int(updated), 'saved_status': 'pending'})

    forged = sql(f"INSERT INTO restock_requests(status,approved_by,created_by) VALUES('approved','{ADMIN}','{EMP}') RETURNING id", actor=EMP)
    assert sql(f"SELECT status FROM restock_requests WHERE id='{forged}'") == 'approved'
    sql(f"UPDATE restock_requests SET status='completed' WHERE id='{forged}'", actor=EMP)
    assert sql(f"SELECT status FROM restock_requests WHERE id='{forged}'") == 'completed'
    record('Direct employee requests bypass restock manager approval, including forged approval fields', {'inserted_status': 'approved', 'employee_updated_status': 'completed'})

    incident = sql(f"INSERT INTO incidents(title,incident_type,store_id,created_by) VALUES('Other store incident','theft','{FOREIGN}','{OTHER}') RETURNING id", actor=OTHER)
    assert sql(f"SELECT count(*) FROM incidents WHERE id='{incident}'", actor=EMP) == '1'
    assert sql(f"SELECT count(*) FROM incidents WHERE id='{incident}'", role='anon') == '1'
    record('Operations SELECT policies allow cross-store reads and anonymous reads when Data API SELECT grants exist', {'employee_other_store_rows': 1, 'anonymous_rows_with_select_grant': 1})

    audit_template = sql(f"INSERT INTO audit_templates(name,category,created_by) VALUES('Display','display','{MANAGER}') RETURNING id", actor=MANAGER)
    question = sql(f"INSERT INTO audit_questions(template_id,question,max_score,created_by) VALUES('{audit_template}','Display clean?',5,'{MANAGER}') RETURNING id", actor=MANAGER)
    audit = sql(f"INSERT INTO audits(template_id,conducted_by,max_score,created_by) VALUES('{audit_template}','{MANAGER}',5,'{MANAGER}') RETURNING id", actor=MANAGER)
    answer = sql(f"INSERT INTO audit_answers(audit_id,question_id,score,created_by) VALUES('{audit}','{question}',0,'{MANAGER}') RETURNING id", actor=MANAGER)
    error = sql(f"UPDATE audit_answers SET score=4 WHERE id='{answer}'", actor=MANAGER, expected_error='has no field "updated_at"')
    record('Saving audit answers fails because its updated_at trigger targets a missing column', error)

    employee_audit = sql(f"INSERT INTO audits(template_id,conducted_by,max_score,created_by) VALUES('{audit_template}','{EMP}',5,'{EMP}') RETURNING id", actor=EMP)
    sql(f"UPDATE audits SET status='completed', final_score=999 WHERE id='{employee_audit}'", actor=EMP)
    assert sql(f"SELECT final_score FROM audits WHERE id='{employee_audit}'") == '999.00'
    record('Employees can create and finalize audits through direct data requests without manager permission or score bounds', {'employee_final_score': 999, 'max_score': 5})

    checklist = sql(f"INSERT INTO daily_checklists(template_id,type,date,created_by) VALUES('{template}','opening','2026-11-25','{EMP}') RETURNING id", actor=EMP)
    sql(f"INSERT INTO daily_checklist_items(daily_checklist_id,label,created_by) VALUES('{checklist}','Lock store','{EMP}')", actor=EMP)
    sql(f"UPDATE daily_checklists SET status='completed',completed_by='{EMP}',completed_at=now() WHERE id='{checklist}'", actor=EMP)
    assert sql(f"SELECT count(*) FROM daily_checklist_items WHERE daily_checklist_id='{checklist}' AND NOT is_completed") == '1'
    record('Checklist completion is accepted with unchecked required work and no photo', {'status': 'completed', 'unchecked_items': 1, 'photo': None})
    sql(f"INSERT INTO daily_checklists(template_id,type,date,created_by) VALUES('{template}','opening','2026-11-25','{EMP}')", actor=EMP)
    assert sql("SELECT count(*) FROM daily_checklists WHERE type='opening' AND date='2026-11-25'") == '2'
    record('Concurrent starts can create duplicate daily checklists; no uniqueness constraint enforces one per day/type', {'same_day_opening_checklists': 2})

    notification = sql(f"INSERT INTO notification_log(user_id,title,created_by) VALUES('{OTHER}','Other employee operations notice','{MANAGER}') RETURNING id")
    assert sql(f"SELECT count(*) FROM notification_log WHERE id='{notification}'", actor=EMP) == '1'
    record('Legacy operations notifications remain readable by other employees after all migrations', {'other_recipient_rows': 1})

    assert sql("SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename IN ('tasks','shelf_inspections','daily_checklist_items')") == '0'
    record('Operations migrations do not publish task, inspection, or checklist changes to Realtime', {'published_operations_tables': 0})

    date_result = sql("SELECT ('2026-11-25T00:30:00+05:30'::timestamptz AT TIME ZONE 'UTC')::date || '/' || ('2026-11-25T00:30:00+05:30'::timestamptz AT TIME ZONE 'Asia/Kolkata')::date")
    assert date_result == '2026-11-24/2026-11-25'
    record('UTC checklist date differs from the store business date before 05:30 IST', {'utc_date/store_date': date_result})

    result_file = Path(__file__).with_name('database-checks.json')
    result_file.write_text(json.dumps({'scope': 'Disposable local PostgreSQL, repository migrations; hosted state not inspected. After reproducing the clean-install failure, a test-only notification_log.created_by column lets the remaining migrations and checks run.', 'findings': checks}, indent=2) + '\n')
    print(f'{len(checks)} findings reproduced. Evidence: {result_file}')
finally:
    if started:
        command('pg_ctl', '-D', str(cluster / 'data'), '-m', 'fast', '-w', 'stop')
    shutil.rmtree(cluster)
