"""Migration 006 tests against ONLY a disposable local PostgreSQL database.
No environment variables, Supabase credentials or remote database connections.
"""
import json
from pathlib import Path
import subprocess
import time
import uuid
import sys
from attendance_fixture import BASE_SCHEMA

ROOT=Path(__file__).resolve().parents[1]
BIN='/opt/homebrew/opt/postgresql@17/bin/'
CONNECTION=['-h','/private/tmp','-p','55439','-U','audit_owner']
NAME='attendance_engine_test_'+uuid.uuid4().hex[:12]
PSQL=[BIN+'psql','-X','-qAt',*CONNECTION,'-d',NAME,'-v','ON_ERROR_STOP=1']
EMP='00000000-0000-4000-8000-000000000001'
ADMIN='00000000-0000-4000-8000-000000000002'
OTHER='00000000-0000-4000-8000-000000000003'
MANAGER='00000000-0000-4000-8000-000000000004'
STORE='10000000-0000-4000-8000-000000000001'
FOREIGN='10000000-0000-4000-8000-000000000002'
SHIFT='20000000-0000-4000-8000-000000000001'
PRESET='30000000-0000-4000-8000-000000000001'
checks=[]

def run(sql,actor=None,error=None):
    if actor: sql=f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{actor}',false); "+sql
    r=subprocess.run(PSQL+['-c',sql],capture_output=True,text=True)
    if error: assert r.returncode and error in r.stderr,r.stderr or r.stdout
    else: assert r.returncode==0,r.stderr
    return r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ''
def literal(value): return "'"+json.dumps(value).replace("'","''")+"'::jsonb"
def sqlcommand(command,key=None):
    return f"SELECT public.attendance_transition({literal(command)},'{key or uuid.uuid4()}','app_dashboard')"
def call(command,actor=EMP,key=None,error=None):
    result=json.loads(run(sqlcommand(command,key),actor=actor))
    if error: assert result.get('success') is False and error in result.get('error',''),result
    else: assert result.get('success') is True,result
    return result

def check(name):checks.append(name);print('PASS:',name,flush=True)
def reset():
    run(f"""TRUNCATE attendance_operations,attendance_audit_events,attendance,swap_requests,shifts CASCADE;
    DELETE FROM leave_requests;
    UPDATE stores SET lat=24.804,lng=93.943,radius_meters=100 WHERE id='{STORE}';
    UPDATE attendance_policies SET enforce_engine=true,require_location_metadata=false,require_session_binding=false,max_accuracy_meters=NULL WHERE store_id='{STORE}';
    INSERT INTO shifts(id,employee_id,start_time,end_time,shift_label,status) VALUES('{SHIFT}','{EMP}','{TODAY}T10:00Z','{TODAY}T18:00Z','Day','scheduled');""")

def start(**extra):return {'action':'clock_in','employeeId':EMP,'storeId':STORE,'shiftId':SHIFT,'lat':24.804,'lng':93.943,**extra}

subprocess.run([BIN+'createdb',*CONNECTION,NAME],check=True)
try:
    run(BASE_SCHEMA)
    TODAY=run("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date")
    migrations=['005_shift_attendance_lock.sql','006_attendance_engine.sql','006_attendance_engine.sql']
    if '--with-smart-scan' in sys.argv or '--with-reminders' in sys.argv:migrations+=['007_attendance_stations.sql','20261124080524_attendance_smart_scan.sql']
    if '--with-reminders' in sys.argv:migrations+=['20261124094512_attendance_reminders.sql']
    for migration in migrations:
        r=subprocess.run(PSQL+['-f',str(ROOT/'supabase/migrations'/migration)],capture_output=True,text=True)
        assert r.returncode==0,r.stderr
    check('005 + 006 apply, and 006 can rerun without destructive changes')
    run(f"INSERT INTO attendance_policies(store_id,enforce_engine,created_by) VALUES('{STORE}',true,'{ADMIN}'),('{FOREIGN}',true,'{ADMIN}')")
    reset()
    call(start(),actor=OTHER,error='ATTENDANCE_FORBIDDEN')
    call(start(storeId=FOREIGN),error='ATTENDANCE_WRONG_BRANCH')
    assert run('SELECT count(*) FROM attendance')=='0'
    check('cross-employee and cross-branch attendance are rejected')
    result=call(start()); record=result['data']; assert record['version']==1 and record['check_in_lat']==24.804
    assert run(f"SELECT attendance_started_at IS NOT NULL FROM shifts WHERE id='{SHIFT}'")=='t'
    assert run("SELECT count(*) FROM attendance_audit_events WHERE event_type='clock_in'")=='1'
    check('manual clock-in stores server time, metadata, a permanent shift lock and audit event')
    reset(); key=str(uuid.uuid4()); first=call(start(),key=key); second=call(start(),key=key)
    assert second['replayed'] and first['data']['id']==second['data']['id']
    call(start(lng=93.944),key=key,error='ATTENDANCE_IDEMPOTENCY_CONFLICT')
    assert run('SELECT count(*) FROM attendance')=='1'
    check('stable retries do not duplicate attendance and changed payloads cannot reuse a key')
    call(start()); assert run('SELECT count(*) FROM attendance')=='1'
    check('a repeated clock-in while active never toggles attendance to clock-out')
    row=first['data']; out=call({'action':'clock_out','employeeId':EMP,'attendanceId':row['id'],'expectedVersion':1})
    assert out['data']['check_out'] and out['data']['version']==2
    call(start(),error='ATTENDANCE_COMPLETED')
    call({'action':'clock_out','employeeId':EMP,'attendanceId':row['id'],'expectedVersion':1},error='ATTENDANCE_STALE')
    check('exact-session clock-out works without GPS and completed shifts cannot clock in again')
    request_id=run(f"INSERT INTO swap_requests(requestor_id,receiver_id,shift_id,message,status) VALUES('{EMP}','{EMP}','{SHIFT}','OVERRIDE REQUEST: Accidental check-out on {TODAY}','pending') RETURNING id",actor=EMP)
    call({'action':'approve_reentry','requestId':request_id},actor=MANAGER,error='ATTENDANCE_FORBIDDEN')
    key=str(uuid.uuid4()); reopened=call({'action':'approve_reentry','requestId':request_id},actor=ADMIN,key=key)
    assert reopened['data']['version']==3 and reopened['data']['check_out'] is None
    assert call({'action':'approve_reentry','requestId':request_id},actor=ADMIN,key=key)['replayed']
    call({'action':'approve_reentry','requestId':request_id},actor=ADMIN,error='ATTENDANCE_REQUEST_STALE')
    call({'action':'clock_out','employeeId':EMP,'attendanceId':row['id'],'expectedVersion':1},error='ATTENDANCE_STALE')
    assert run(f"SELECT previous_values->>'check_out' IS NOT NULL FROM attendance_audit_events WHERE event_type='approve_reentry'")=='t'
    check('re-entry is admin-only, atomic and single-use; old checkout and stale session versions remain protected')
    reset(); run(f"INSERT INTO leave_requests(employee_id,start_date,end_date,status) VALUES('{EMP}','{TODAY}','{TODAY}','approved')")
    call(start(),error='ATTENDANCE_ON_LEAVE');run('DELETE FROM leave_requests; DELETE FROM shifts;')
    call(start(),error='ATTENDANCE_SHIFT_UNAVAILABLE')
    check('approved leave and an off day do not create attendance')
    reset(); call(start(lat=None),error='ATTENDANCE_LOCATION_UNAVAILABLE')
    call(start(lat=91),error='ATTENDANCE_LOCATION_UNAVAILABLE')
    call(start(lat=0,lng=0),error='ATTENDANCE_OUTSIDE_STORE')
    run(f"UPDATE stores SET lat=NULL WHERE id='{STORE}'");call(start(),error='ATTENDANCE_LOCATION_UNAVAILABLE')
    check('invalid, remote and missing locations cannot bypass verification')
    reset(); run(f"UPDATE stores SET lat=0,lng=0 WHERE id='{STORE}'");call(start(lat=0,lng=0))
    check('zero latitude/longitude are legitimate configured store coordinates')
    reset();run(f"UPDATE stores SET radius_meters=0 WHERE id='{STORE}'");assert call({'action':'state'})['policy']['radiusMeters']==100;call(start())
    check('a legacy zero radius retains the existing 100m default')
    reset(); now=run('SELECT clock_timestamp()'); stale=run("SELECT clock_timestamp()-interval '2 minutes'")
    call(start(accuracy=500,capturedAt=now),error='ATTENDANCE_LOCATION_RETRY')
    call(start(accuracy=10,capturedAt=stale),error='ATTENDANCE_LOCATION_RETRY')
    call(start(accuracy=10),error='ATTENDANCE_LOCATION_METADATA_REQUIRED')
    run(f"UPDATE attendance_policies SET require_location_metadata=true,max_accuracy_meters=50 WHERE store_id='{STORE}'")
    call(start(),error='ATTENDANCE_LOCATION_METADATA_REQUIRED')
    call(start(accuracy=20,capturedAt=run('SELECT clock_timestamp()')))
    check('location age, uncertainty, paired metadata and strict-policy rollout are enforced')
    reset(); call(start()); row=json.loads(run('SELECT to_jsonb(a) FROM attendance a'))
    call({'action':'admin_update','attendanceId':row['id'],'updates':{'check_out':'2000-01-01T00:00:00Z'}},actor=ADMIN,error='ATTENDANCE_INVALID_TIMES')
    call({'action':'admin_delete','attendanceId':row['id']},error='ATTENDANCE_FORBIDDEN')
    assert run('SELECT count(*) FROM attendance')=='1'
    key=str(uuid.uuid4());call({'action':'admin_delete','attendanceId':row['id']},actor=ADMIN,key=key)
    assert call({'action':'admin_delete','attendanceId':row['id']},actor=ADMIN,key=key)['replayed']
    assert run("SELECT count(*) FROM attendance_audit_events WHERE event_type='admin_delete' AND previous_values IS NOT NULL")=='1'
    assert run(f"SELECT attendance_started_at IS NOT NULL FROM shifts WHERE id='{SHIFT}'")=='t'
    check('admin corrections validate merged times and deletion preserves history and shift locks')
    reset(); call({'action':'admin_create','employeeId':EMP,'shift_id':PRESET,'check_in':TODAY+'T04:00:00Z','check_out':TODAY+'T05:00:00Z'},actor=ADMIN)
    assert run('SELECT shift_id FROM attendance')==SHIFT
    check('legacy manual-entry preset IDs resolve to an actual assigned shift')
    reset(); call(start()); run('UPDATE attendance SET check_out=clock_timestamp()')
    run("UPDATE attendance_audit_events SET reason='forged'",actor=ADMIN,error='permission denied')
    run('DELETE FROM attendance_audit_events',actor=EMP,error='permission denied')
    run("UPDATE attendance_operations SET response='{}'",actor=EMP,error='permission denied')
    run(f"INSERT INTO attendance(employee_id,store_id,shift_id,check_in) VALUES('{EMP}','{STORE}','{SHIFT}',clock_timestamp())",actor=EMP,error='ATTENDANCE_ENGINE_REQUIRED')
    check('enforced branches reject raw employee attendance writes and audit/idempotency rewrites')
    assert run('SELECT count(*) FROM attendance_policies',actor=EMP)=='1'
    assert run('SELECT count(*) FROM attendance_audit_events',actor=OTHER)=='0'
    assert int(run('SELECT count(*) FROM attendance_audit_events',actor=MANAGER))>0
    run(f"UPDATE profiles SET role='admin' WHERE id='{EMP}'",actor=EMP,error='cannot change')
    run(f"UPDATE stores SET radius_meters=99999 WHERE id='{STORE}'",actor=EMP,error='Only an administrator')
    check('RLS isolates branches; employees cannot self-promote or widen the store geofence')
    reset(); command=sqlcommand(start()); prefix=f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{EMP}',false); "
    first=subprocess.Popen(PSQL+['-c',prefix+'BEGIN; '+command+'; SELECT pg_sleep(0.4); COMMIT;'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    time.sleep(.1);second=subprocess.Popen(PSQL+['-c',prefix+command],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    for proc in [first,second]:
        output,error=proc.communicate(timeout=10);assert proc.returncode==0,error
    assert run('SELECT count(*) FROM attendance')=='1'
    check('real simultaneous transactions create only one active attendance row')
    reset()
    run(f"UPDATE shifts SET start_time=('{TODAY}'::date-1)+time '22:00',end_time='{TODAY}T23:59:59Z' WHERE id='{SHIFT}'")
    overnight=call(start())
    assert overnight['data']['shift_id']==SHIFT
    call({'action':'clock_out','employeeId':EMP,'attendanceId':overnight['data']['id'],'expectedVersion':1})
    check('an overnight shift permits arrival after its starting business day and still clocks out normally')
    reset(); call(start());row=json.loads(run('SELECT to_jsonb(a) FROM attendance a'))
    run(f"UPDATE attendance_policies SET require_session_binding=true WHERE store_id='{STORE}'")
    call({'action':'clock_out','employeeId':EMP},error='ATTENDANCE_STALE')
    call({'action':'clock_out','employeeId':EMP,'attendanceId':row['id'],'expectedVersion':row['version']})
    assert int(run("SELECT count(*) FROM attendance_audit_events WHERE event_type='policy_changed'"))>0
    check('strict session binding can roll out separately and policy changes are audited')
    reset();run(f"UPDATE profiles SET role=NULL WHERE id='{OTHER}'")
    call({'action':'admin_create','employeeId':EMP,'check_in':TODAY+'T04:00:00Z'},actor=OTHER,error='ATTENDANCE_FORBIDDEN')
    run(f"UPDATE profiles SET role='employee' WHERE id='{OTHER}'")
    check('a missing profile role never grants administrative attendance access')
    reset();run(f"UPDATE attendance_policies SET enforce_engine=false WHERE store_id='{STORE}'")
    run(f"INSERT INTO attendance(employee_id,store_id,shift_id,check_in) VALUES('{EMP}','{STORE}','{SHIFT}',clock_timestamp())",actor=EMP)
    assert run("SELECT count(*) FROM attendance_audit_events WHERE event_type='legacy_insert'")=='1'
    check('staged enforcement preserves legacy writes with an audit before the server rollout')
    reset(); row=call(start())['data']
    out_command={'action':'clock_out','employeeId':EMP,'attendanceId':row['id'],'expectedVersion':1}
    prefix=f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{EMP}',false); "
    first=subprocess.Popen(PSQL+['-c',prefix+'BEGIN; '+sqlcommand(out_command)+'; SELECT pg_sleep(0.3); COMMIT;'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    time.sleep(.1); second=subprocess.Popen(PSQL+['-c',prefix+sqlcommand(out_command)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    for proc in [first,second]:
        output,error=proc.communicate(timeout=10);assert proc.returncode==0,error
    assert run("SELECT count(*) FROM attendance_audit_events WHERE event_type='clock_out'")=='1'
    assert run('SELECT version FROM attendance')=='2'
    check('concurrent checkout requests produce one version change and one checkout event')
    reset(); row=call(start())['data'];call({'action':'clock_out','employeeId':EMP,'attendanceId':row['id'],'expectedVersion':1})
    request_id=run(f"INSERT INTO swap_requests(requestor_id,receiver_id,shift_id,message,status) VALUES('{EMP}','{EMP}','{SHIFT}','OVERRIDE REQUEST: Accidental check-out on {TODAY}','pending') RETURNING id",actor=EMP)
    run("CREATE FUNCTION block_test_approval() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test approval failure'; END $$; CREATE TRIGGER fail_test_approval BEFORE UPDATE ON swap_requests FOR EACH ROW EXECUTE FUNCTION block_test_approval();")
    result=json.loads(run(sqlcommand({'action':'approve_reentry','requestId':request_id}),actor=ADMIN))
    assert result['success'] is False
    assert run('SELECT check_out IS NOT NULL FROM attendance')=='t'
    assert run(f"SELECT status FROM swap_requests WHERE id='{request_id}'")=='pending'
    assert run("SELECT count(*) FROM attendance_audit_events WHERE event_type='approve_reentry'")=='0'
    run('DROP TRIGGER fail_test_approval ON swap_requests; DROP FUNCTION block_test_approval();')
    check('a failed request approval rolls back attendance, version and success-audit changes together')
    run('SET ROLE anon; SELECT public.attendance_transition(\'{"action":"state"}\',NULL,\'app_dashboard\')',error='permission denied')
    check('anonymous callers cannot execute the attendance RPC')
    # Ambiguous historical rows are retained, not silently cleaned up.
    reset();run('ALTER TABLE attendance DISABLE TRIGGER hrm_attendance_guard')
    run(f"INSERT INTO attendance(employee_id,check_in) VALUES('{EMP}',clock_timestamp()-interval '2 hours'),('{EMP}',clock_timestamp()-interval '1 hour')")
    run('ALTER TABLE attendance ENABLE TRIGGER hrm_attendance_guard')
    call({'action':'clock_out','employeeId':EMP},error='ATTENDANCE_CONFLICT')
    assert run('SELECT count(*) FROM attendance WHERE check_out IS NULL')=='2'
    assert call({'action':'state'})['state']=='attendance_exception'
    check('legacy multiple-open sessions remain intact and require explicit reconciliation')
    print(json.dumps({'database':'disposable local PostgreSQL only','checks':checks,'passed':len(checks)},indent=2))
finally:
    subprocess.run([BIN+'dropdb',*CONNECTION,'--if-exists',NAME],check=True)
