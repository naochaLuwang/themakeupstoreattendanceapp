"""Smart Scan: disposable local PostgreSQL only; no .env or hosted connection."""
import hashlib
import json
from pathlib import Path
import subprocess
import uuid
import time
from attendance_fixture import BASE_SCHEMA, EMP, ADMIN, OTHER, MANAGER, STORE, SHIFT

ROOT=Path(__file__).resolve().parents[1]
BIN='/opt/homebrew/opt/postgresql@17/bin/'
CONNECTION=['-h','/private/tmp','-p','55439','-U','audit_owner']
NAME='scan_test_'+uuid.uuid4().hex[:12]
PSQL=[BIN+'psql','-X','-qAt',*CONNECTION,'-d',NAME,'-v','ON_ERROR_STOP=1']
checks=[]
def run(sql,actor=None,error=None):
    if actor:sql=f"SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','{actor}',false);"+sql
    r=subprocess.run(PSQL+['-c',sql],capture_output=True,text=True)
    if error:assert r.returncode and error in r.stderr,r.stderr or r.stdout
    else:assert r.returncode==0,r.stderr
    return r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ''
def literal(value):return "'"+json.dumps(value).replace("'","''")+"'::jsonb"
def sql(command,key=None):return f"SELECT public.attendance_smart_scan({literal(command)},'{key or uuid.uuid4()}')"
def call(command,actor=EMP,key=None,error=None):
    result=json.loads(run(sql(command,key),actor=actor))
    if error:assert not result['success'] and error in result['error'],result
    else:assert result['success'],result
    return result
def check(name):checks.append(name);print('PASS:',name,flush=True)
def location(**changes):return {'lat':24.804,'lng':93.943,'accuracy':10,'capturedAt':run('SELECT clock_timestamp()'),**changes}
def reset():
    run(f"TRUNCATE attendance_operations,attendance_audit_events,attendance,hrm_private.attendance_qr_attempts,hrm_private.attendance_qr_operations,shifts CASCADE;DELETE FROM leave_requests;UPDATE attendance_station_devices SET revoked_at=NULL,credential_expires_at=clock_timestamp()+interval '1 day';UPDATE attendance_stations SET active=true;INSERT INTO shifts(id,employee_id,start_time,end_time,shift_label,status) VALUES('{SHIFT}','{EMP}','{TODAY}T10:00Z','{TODAY}T18:00Z','Day','scheduled');")
def qr():
    run("UPDATE hrm_private.attendance_station_tokens SET created_at=clock_timestamp()-interval '31 seconds'")
    nonce=str(uuid.uuid4());mac='A'*43
    reply=json.loads(run(f"SET ROLE anon;SELECT public.attendance_station_device('issue','{'a'*64}','{station}','{nonce}','{hashlib.sha256(mac.encode()).hexdigest()}',NULL)"))
    assert reply['success'],reply
    return 'hrm.attendance.v1.'+reply['data']['tokenId']+'.'+mac
def scan(token=None,**changes):return {'action':'scan','token':token or qr(),'location':location(),**changes}
def confirm(response,**changes):return {'action':'confirm','confirmationId':response['confirmationId'],'location':location(),**changes}

subprocess.run([BIN+'createdb',*CONNECTION,NAME],check=True)
try:
    run(BASE_SCHEMA)
    migration=ROOT/'supabase/migrations/20261124080524_attendance_smart_scan.sql'
    for path in [ROOT/'supabase/migrations'/name for name in ['005_shift_attendance_lock.sql','006_attendance_engine.sql','007_attendance_stations.sql']]+[migration,migration]:
        r=subprocess.run(PSQL+['-f',str(path)],capture_output=True,text=True);assert r.returncode==0,r.stderr
    preflight=subprocess.run(PSQL+['-f',str(ROOT/'supabase/checks/smart_scan_preflight.sql')],capture_output=True,text=True);assert preflight.returncode==0,preflight.stderr
    TODAY=run("SELECT (clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date")
    station=run(f"INSERT INTO attendance_stations(store_id,name) VALUES('{STORE}','Test counter') RETURNING id")
    device=run(f"INSERT INTO attendance_station_devices(station_id,name,approved_at,pairing_expires_at,credential_expires_at) VALUES('{station}','Test display',clock_timestamp(),clock_timestamp(),clock_timestamp()+interval '1 day') RETURNING id")
    run(f"INSERT INTO hrm_private.attendance_station_keys(device_id,credential_hash) VALUES('{device}','{hashlib.sha256(('a'*64).encode()).hexdigest()}')")
    assert call({'action':'config'})['enabled'] is False
    call(scan(),error='ATTENDANCE_SCAN_DISABLED')
    run(f"INSERT INTO attendance_policies(store_id,smart_qr_enabled) VALUES('{STORE}',true)",error='smart_qr_requires_engine')
    run(f"INSERT INTO attendance_policies(store_id,smart_qr_enabled,enforce_engine) VALUES('{STORE}',true,true)")
    check('migration is rerunnable, defaults disabled and requires engine enforcement for opt-in')
    run("SET ROLE anon; SELECT public.attendance_smart_scan('{}',NULL)",error='permission denied')
    run('SELECT * FROM hrm_private.attendance_qr_attempts',actor=EMP,error='permission denied')
    run('SELECT * FROM hrm_private.attendance_qr_operations',actor=ADMIN,error='permission denied')
    call({'action':'config'},actor=ADMIN,error='ATTENDANCE_FORBIDDEN')
    reset()
    forged=json.loads(run(f"SELECT public.attendance_transition({literal({'action':'clock_in','employeeId':EMP,'storeId':STORE,'lat':24.804,'lng':93.943})},'{uuid.uuid4()}','smart_scan')",actor=EMP))
    assert not forged['success'] and 'verified QR context' in forged['error'],forged
    check('anonymous/private-table access and forged QR entry points are denied')
    token=qr();body=scan(token);key=str(uuid.uuid4());started=call(body,key=key)
    assert started['state']=='clocked_in' and started['data']['attendance_method']=='smart_qr' and started['data']['entry_point']=='smart_scan'
    assert call(body,key=key)['replayed'] is True
    repeated=call(body);assert repeated['state']=='clocked_in' and repeated['changed'] is False and 'confirmationId' not in repeated
    assert run('SELECT count(*) FROM attendance')=='1'
    call({**body,'location':location(accuracy=9)},key=key,error='ATTENDANCE_IDEMPOTENCY_CONFLICT')
    assert run("SELECT attendance_method FROM attendance_audit_events WHERE event_type='clock_in'")=='smart_qr'
    check('clock-in is QR-attributed; repeated frames and lost-response retries cannot become clock-out')
    pending=call(scan());assert pending['state']=='confirmation_required'
    assert run('SELECT check_out IS NULL FROM attendance')=='t'
    call(confirm(pending),actor=MANAGER,error='ATTENDANCE_CONFIRMATION_INVALID')
    call(confirm(pending,location=location(capturedAt='2020-01-01T00:00Z')),error='ATTENDANCE_LOCATION_RETRY')
    completed=call(confirm(pending));assert completed['state']=='completed' and completed['data']['check_out_method']=='smart_qr'
    assert completed['data']['check_out_location_accuracy']==10 and completed['data']['attendance_method']=='smart_qr'
    call(confirm(pending),error='ATTENDANCE_CONFIRMATION_EXPIRED')
    call(scan(),error='ATTENDANCE_COMPLETED')
    check('active attendance requires employee-bound explicit confirmation; completed shifts cannot restart')
    reset();manual=json.loads(run(f"SELECT public.attendance_transition({literal({'action':'clock_in','employeeId':EMP,'storeId':STORE,'lat':24.804,'lng':93.943})},'{uuid.uuid4()}','app_dashboard')",actor=EMP));assert manual['success']
    pending=call(scan());body=confirm(pending);key=str(uuid.uuid4());result=call(body,key=key)
    assert result['data']['attendance_method']=='manual' and result['data']['check_out_method']=='smart_qr'
    assert call(body,key=key)['replayed'] and run('SELECT version FROM attendance')=='2'
    check('QR checkout preserves manual check-in provenance and exact retries do not increment the version')
    reset()
    for bad in [location(accuracy=500),location(accuracy=None),location(capturedAt='2020-01-01T00:00Z'),location(capturedAt='2099-01-01T00:00Z'),location(lat=0,lng=0),location(lat=24.8047,accuracy=50)]:
        result=call(scan(location=bad),error='ATTENDANCE_');assert not result['success']
    assert run('SELECT count(*) FROM attendance')=='0' and run('SELECT count(*) FROM hrm_private.attendance_qr_attempts')=='0'
    check('stale/missing/imprecise/outside/boundary-overlapping locations fail with no partial attendance or redemption')
    reset();call(scan());pending=call(scan());run('UPDATE attendance SET check_in=check_in-interval \'1 minute\'')
    call(confirm(pending),error='ATTENDANCE_STALE')
    assert run('SELECT check_out IS NULL FROM attendance')=='t'
    assert run("SELECT count(*) FROM hrm_private.attendance_qr_attempts WHERE context_transaction_id IS NOT NULL")=='0'
    check('session version changes invalidate confirmation and roll back privileged write context')
    reset();call(scan());pending=call(scan());run("UPDATE hrm_private.attendance_qr_attempts SET confirmation_expires_at=clock_timestamp()-interval '1 second' WHERE phase='confirmation_required'")
    call(confirm(pending),error='ATTENDANCE_CONFIRMATION_EXPIRED')
    pending=call(scan());run(f"UPDATE attendance_station_devices SET revoked_at=clock_timestamp() WHERE id='{device}'")
    call(confirm(pending),error='ATTENDANCE_STATION_REVOKED')
    assert run('SELECT check_out IS NULL FROM attendance')=='t'
    check('expired confirmations and revoked displays cannot close a session')
    reset();token=qr();run(f"UPDATE hrm_private.attendance_station_tokens SET expires_at=clock_timestamp()-interval '1 second' WHERE id='{token.split('.')[3]}'")
    call(scan(token),error='STATION_TOKEN_EXPIRED')
    call(scan(qr()[:-1]+'B'),error='STATION_TOKEN_EXPIRED')
    run(f"INSERT INTO attendance_policies(store_id,enforce_engine,smart_qr_enabled) SELECT store_id,true,true FROM profiles WHERE id='{OTHER}'")
    call(scan(),actor=OTHER,error='STATION_WRONG_BRANCH')
    check('expired/tampered tokens and cross-branch scans fail')
    reset();token=qr();run(f"INSERT INTO shifts(employee_id,start_time,end_time,shift_label,status) VALUES('{MANAGER}','{TODAY}T10:00Z','{TODAY}T18:00Z','Day','scheduled')")
    assert call(scan(token))['state']=='clocked_in' and call(scan(token),actor=MANAGER)['state']=='clocked_in'
    assert run('SELECT count(*) FROM attendance')=='2'
    check('one station QR supports multiple separately authenticated employees')
    reset();token=qr();body=scan(token);queries=[sql(body),sql(body)]
    processes=[subprocess.Popen(PSQL+['-c',f"SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','{EMP}',false);"+query],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for query in queries]
    replies=[]
    for process in processes:
        output,err=process.communicate(timeout=10);assert process.returncode==0,err;replies.append(json.loads(output.strip().splitlines()[-1]))
    assert all(r['success'] and r['state']=='clocked_in' for r in replies),replies
    assert sum(bool(r.get('changed')) for r in replies)==1 and run('SELECT count(*) FROM attendance')=='1'
    check('concurrent requests with different operation IDs redeem one employee/token once')
    pending=call(scan());body=confirm(pending)
    processes=[subprocess.Popen(PSQL+['-c',f"SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','{EMP}',false);"+sql(body)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for _ in range(2)]
    replies=[]
    for process in processes:
        output,err=process.communicate(timeout=10);assert process.returncode==0,err;replies.append(json.loads(output.strip().splitlines()[-1]))
    assert sum(bool(r['success']) for r in replies)==1,replies
    assert run('SELECT version FROM attendance')=='2'
    check('concurrent confirmations close the bound session exactly once')
    reset();call(scan());pending=call(scan())
    run(f"UPDATE hrm_private.attendance_station_tokens SET expires_at=clock_timestamp()-interval '1 second' WHERE id=(SELECT token_id FROM hrm_private.attendance_qr_attempts WHERE id='{pending['confirmationId']}')")
    assert call(confirm(pending))['state']=='completed'
    check('a valid short-lived confirmation can outlive its original QR, with fresh GPS and reauthorization checks')
    reset();body=scan()
    revoke={'action':'revoke','stationId':station,'deviceId':device}
    process=subprocess.Popen(PSQL+['-c',f"SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','{ADMIN}',false);BEGIN;SELECT public.attendance_station_admin({literal(revoke)});SELECT pg_sleep(0.5);COMMIT;"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    time.sleep(0.15);call(body,error='STATION_REVOKED');output,err=process.communicate(timeout=10);assert process.returncode==0,err
    assert run('SELECT count(*) FROM attendance')=='0'
    check('revocation that commits while a scan waits for the station lock prevents attendance')
    print(json.dumps({'database':'disposable local PostgreSQL only','passed':len(checks),'checks':checks},indent=2))
finally:subprocess.run([BIN+'dropdb',*CONNECTION,NAME],check=True)
