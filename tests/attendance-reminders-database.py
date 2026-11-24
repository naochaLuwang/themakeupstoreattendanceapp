"""Reminder queue integration tests: disposable local PostgreSQL, no .env/network."""
import json
from pathlib import Path
import subprocess
import uuid
from attendance_fixture import BASE_SCHEMA, EMP, ADMIN, OTHER, MANAGER, STORE, FOREIGN, SHIFT

ROOT=Path(__file__).resolve().parents[1];BIN='/opt/homebrew/opt/postgresql@17/bin/'
CONNECTION=['-h','/private/tmp','-p','55439','-U','audit_owner'];NAME='reminder_test_'+uuid.uuid4().hex[:12]
PSQL=[BIN+'psql','-X','-qAt',*CONNECTION,'-d',NAME,'-v','ON_ERROR_STOP=1'];checks=[]
secret='a'*64
settings={'enabled':True,'upcoming_minutes':15,'missed_in_minutes':5,'late_minutes':30,'ending_minutes':5,'missed_out_minutes':15,'unresolved_minutes':60,'cooldown_minutes':15,'delivery_window_minutes':30}
prefs={'enabled':True,'upcoming_shift':True,'missed_clock_in':True,'shift_ending':True,'missed_clock_out':True,'manager_alerts':True,'quiet_start':None,'quiet_end':None}
def literal(value):return "'"+json.dumps(value).replace("'","''")+"'::jsonb"
def run(sql,actor=None,service=False,error=None):
    if service:sql='SET ROLE service_role;'+sql
    elif actor:sql=f"SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','{actor}',false);"+sql
    r=subprocess.run(PSQL+['-c',sql],capture_output=True,text=True)
    if error:assert r.returncode and error in r.stderr,r.stderr or r.stdout
    else:assert r.returncode==0,r.stderr
    return r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ''
def rpc(name,command,actor=EMP,service=False,error=None):
    result=json.loads(run(f'SELECT public.{name}({literal(command)})',actor=None if service else actor,service=service))
    if error:assert not result['success'] and error in result['error'],result
    else:assert result['success'],result
    return result.get('data',result)
def user(command,actor=EMP,error=None):return rpc('attendance_notification_user',command,actor=actor,error=error)
def admin(command,actor=ADMIN,error=None):return rpc('attendance_reminder_admin',command,actor=actor,error=error)
def worker(action,**args):return rpc('attendance_reminder_worker',{'action':action,**args},service=True)
def check(name):checks.append(name);print('PASS:',name,flush=True)
def reset(start=10,end=490):
    run(f"TRUNCATE notification_log,hrm_private.attendance_push_deliveries,hrm_private.attendance_reminder_jobs,attendance_operations,attendance_audit_events,attendance,shifts CASCADE;DELETE FROM leave_requests;DELETE FROM attendance_notification_preferences;UPDATE attendance_notification_devices SET enabled=true,revoked_at=NULL WHERE id IN (SELECT device_id FROM hrm_private.attendance_notification_keys);UPDATE profiles SET store_id='{STORE}' WHERE id='{MANAGER}';UPDATE attendance_reminder_settings SET cooldown_minutes=15 WHERE store_id='{STORE}';INSERT INTO shifts(id,employee_id,start_time,end_time,shift_label,status) VALUES('{SHIFT}','{EMP}',(clock_timestamp()+make_interval(mins=>{start})) AT TIME ZONE 'Asia/Kolkata' AT TIME ZONE 'UTC',(clock_timestamp()+make_interval(mins=>{end})) AT TIME ZONE 'Asia/Kolkata' AT TIME ZONE 'UTC','Day','scheduled');")
def claim():worker('plan');return worker('claim')['items']
def authorize(item):return worker('authorize',deliveryId=item['id'],leaseToken=item['leaseToken'])
def finish(item,outcome,**extra):return worker('finish',deliveryId=item['id'],leaseToken=item['leaseToken'],outcome=outcome,**extra)
def active():run(f"INSERT INTO attendance(employee_id,store_id,shift_id,check_in) VALUES('{EMP}','{STORE}','{SHIFT}',clock_timestamp()-interval '1 minute')")

subprocess.run([BIN+'createdb',*CONNECTION,NAME],check=True)
try:
    run(BASE_SCHEMA)
    run('CREATE PUBLICATION supabase_realtime;')
    # Model the legacy broad history policy to prove new rows stay private.
    run('CREATE TABLE notification_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES profiles(id),title text NOT NULL,body text,type text,link text,is_read boolean DEFAULT false,created_at timestamptz DEFAULT now());ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;GRANT SELECT,INSERT,UPDATE,DELETE ON notification_log TO authenticated;CREATE POLICY legacy_read ON notification_log FOR SELECT TO authenticated USING(true);CREATE POLICY legacy_write ON notification_log FOR ALL TO authenticated USING(true) WITH CHECK(true);')
    names=['005_shift_attendance_lock.sql','006_attendance_engine.sql','007_attendance_stations.sql','20261124080524_attendance_smart_scan.sql','20261124094512_attendance_reminders.sql','20261124094512_attendance_reminders.sql']
    for name in names:
        r=subprocess.run(PSQL+['-f',str(ROOT/'supabase/migrations'/name)],capture_output=True,text=True);assert r.returncode==0,r.stderr
    assert run("SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notification_log'")=='1'
    preflight=subprocess.run(PSQL+['-f',str(ROOT/'supabase/checks/attendance_reminders_preflight.sql')],capture_output=True,text=True);assert preflight.returncode==0,preflight.stderr
    reset();worker('plan');assert run('SELECT count(*) FROM hrm_private.attendance_reminder_jobs')=='0'
    admin({'action':'save','storeId':STORE,'settings':settings},actor=EMP,error='REMINDER_FORBIDDEN')
    admin({'action':'save','storeId':STORE,'settings':settings})
    run("SET ROLE anon;SELECT public.attendance_notification_user('{}')",error='permission denied')
    run("SELECT public.attendance_reminder_worker('{}')",actor=ADMIN,error='permission denied')
    run('SELECT * FROM hrm_private.attendance_notification_keys',actor=EMP,error='permission denied')
    check('migrations rerun; branches default off; employee/admin/worker permissions are separate')
    enrolled=user({'action':'register','installationSecret':secret,'provider':'fcm','name':'Test phone','credential':{'token':'A'*100}});device=enrolled['currentDeviceId'];assert device
    assert 'A'*100 not in json.dumps(enrolled) and secret not in json.dumps(enrolled)
    user({'action':'register','installationSecret':'b'*64,'provider':'fcm','name':'Other phone','credential':{'token':'A'*100}},actor=OTHER,error='REMINDER_DEVICE_BOUND')
    user({'action':'register','installationSecret':'b'*64,'provider':'webpush','name':'Bad browser','credential':{'endpoint':'https://127.0.0.1/private','keys':{'p256dh':'A'*87,'auth':'A'*22}}},error='REMINDER_INVALID')
    check('registration stores credentials privately and rejects token hijacking and arbitrary push URLs')
    items=claim();assert len(items)==1,items;payload=authorize(items[0]);assert payload['allowed'] and payload['provider']=='fcm';assert payload['credential']['token']=='A'*100
    assert run('SELECT count(*) FROM notification_log',actor=EMP)=='1' and run('SELECT count(*) FROM notification_log',actor=OTHER)=='0'
    run("UPDATE notification_log SET title='forged'",actor=EMP,error='Only reminder read status')
    run('UPDATE notification_log SET is_read=true',actor=EMP)
    finish(items[0],'sent');claim();assert run('SELECT count(*) FROM notification_log')=='1' and run("SELECT count(*) FROM hrm_private.attendance_push_deliveries WHERE status='sent'")=='1'
    check('due reminders publish once, keep recipient-only history and acknowledge successful per-device delivery')
    reset();items=claim();active();assert authorize(items[0])['allowed'] is False
    assert run("SELECT status FROM hrm_private.attendance_push_deliveries")=='suppressed'
    check('attendance is rechecked after claiming so an obsolete clock-in push is suppressed')
    reset();user({'action':'preferences',**prefs,'enabled':False});assert claim()==[];assert run('SELECT count(*) FROM notification_log')=='0'
    reset();run(f"INSERT INTO leave_requests(employee_id,start_date,end_date,status) VALUES('{EMP}',(clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date-1,(clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date+1,'approved')");assert claim()==[]
    reset();run('DELETE FROM shifts');assert claim()==[]
    check('disabled preferences, approved leave and off days produce no reminders')
    reset();minute=int(run("SELECT extract(hour FROM clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::integer*60+extract(minute FROM clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::integer"));user({'action':'preferences',**prefs,'quiet_start':(minute-1)%1440,'quiet_end':(minute+5)%1440});assert claim()==[]
    assert run("SELECT count(*) FROM hrm_private.attendance_reminder_jobs WHERE reason='quiet_hours_or_cooldown'")=='1'
    check('quiet hours defer delivery without creating history or consuming retries')
    reset();items=claim();authorize(items[0]);finish(items[0],'retry',errorCode='RATE_LIMITED',retryAfter=120)
    assert run("SELECT status FROM hrm_private.attendance_push_deliveries")=='pending'
    run("UPDATE hrm_private.attendance_push_deliveries SET available_at=clock_timestamp()-interval '1 second'");item=worker('claim')['items'][0];authorize(item);finish(item,'blocked_configuration',errorCode='FCM_NOT_CONFIGURED')
    assert run('SELECT attempts FROM hrm_private.attendance_push_deliveries')=='1'
    check('transient errors back off; absent provider configuration does not exhaust attempt budgets')
    reset();item=claim()[0];authorize(item)
    user({'action':'register','installationSecret':secret,'provider':'fcm','name':'Test phone','credential':{'token':'B'*100}})
    finish(item,'invalid_device',errorCode='UNREGISTERED');assert run(f"SELECT enabled FROM attendance_notification_devices WHERE id='{device}'")=='t'
    check('an invalid old token cannot revoke a newly rotated token')
    reset();item=claim()[0];authorize(item);finish(item,'invalid_device',errorCode='UNREGISTERED');assert run(f"SELECT enabled FROM attendance_notification_devices WHERE id='{device}'")=='f'
    check('a genuinely expired current token disables only that device')
    user({'action':'register','installationSecret':secret,'provider':'fcm','name':'Test phone','credential':{'token':'C'*100}})
    reset();item=claim()[0];run("UPDATE hrm_private.attendance_push_deliveries SET lease_until=clock_timestamp()-interval '1 second'");replacement=worker('claim')['items'][0]
    rpc('attendance_reminder_worker',{'action':'finish','deliveryId':item['id'],'leaseToken':item['leaseToken'],'outcome':'sent'},service=True,error='REMINDER_STALE');authorize(replacement);finish(replacement,'sent')
    check('expired worker leases are reclaimed and stale workers cannot acknowledge a replacement lease')
    reset();item=claim()[0];user({'action':'sync','installationSecret':secret},actor=OTHER);assert authorize(item)['allowed'] is False
    assert user({'action':'config','installationSecret':secret})['currentDeviceId'] is None
    other=user({'action':'config','installationSecret':secret},actor=OTHER)
    assert other['currentDeviceId'] and other['currentDeviceId']!=device
    assert EMP not in json.dumps(other['devices'])
    check('account switching detaches old-user delivery without exposing the other account')
    user({'action':'register','installationSecret':secret,'provider':'fcm','name':'Test phone','credential':{'token':'D'*100}})
    reset(start=-40,end=440);claim()
    assert run(f"SELECT count(*) FROM notification_log WHERE user_id='{MANAGER}' AND attendance_manager_alert")=='1'
    assert run(f"SELECT count(*) FROM notification_log WHERE user_id='{ADMIN}' AND attendance_manager_alert")=='1'
    assert run('SELECT count(*) FROM notification_log',actor=OTHER)=='0'
    run(f"UPDATE profiles SET store_id='{FOREIGN}' WHERE id='{MANAGER}'")
    assert run('SELECT count(*) FROM notification_log',actor=MANAGER)=='0'
    check('late attendance escalates only to authorized managers/admins and history follows current branch permissions')
    reset();item=claim()[0];run("UPDATE shifts SET start_time=start_time+interval '1 hour',end_time=end_time+interval '1 hour'");assert authorize(item)['allowed'] is False
    check('changing a shift after enqueue cancels its old push before transport')
    reset(start=-500,end=-20);active();worker('plan');worker('claim')
    assert run("SELECT count(*) FROM notification_log WHERE type='attendance_shift_ending'")=='1'
    assert run("SELECT count(*) FROM hrm_private.attendance_reminder_jobs WHERE kind='missed_clock_out' AND reason='quiet_hours_or_cooldown'")=='1'
    check('active sessions get finish/checkout reminders with cooldown between event kinds')
    reset(start=-600,end=-80);active();claim()
    assert run("SELECT count(*) FROM notification_log WHERE type='attendance_unresolved_attendance'")=='2'
    check('an unresolved active session escalates to current branch managers and administrators')
    reset();run(f"UPDATE shifts SET start_time=(((clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date+interval '1 day'-interval '10 minutes') AT TIME ZONE 'UTC'),end_time=(((clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date+interval '1 day'+interval '8 hours') AT TIME ZONE 'UTC') WHERE id='{SHIFT}'");worker('plan')
    assert run("SELECT extract(epoch FROM (schedule_end-schedule_start))::integer FROM hrm_private.attendance_reminder_jobs LIMIT 1")=='29400'
    check('overnight shift reminder windows use the existing India-time schedule convention')
    reset()
    def transition(command,actor=EMP):return json.loads(run(f"SELECT public.attendance_transition({literal(command)},'{uuid.uuid4()}','app_dashboard')",actor=actor))
    started=transition({'action':'clock_in','employeeId':EMP,'storeId':STORE,'lat':24.804,'lng':93.943});assert started['success'],started
    closed=transition({'action':'clock_out','employeeId':EMP,'attendanceId':started['data']['id'],'expectedVersion':started['data']['version']});assert closed['success'],closed
    request_id=str(uuid.uuid4());run(f"INSERT INTO swap_requests(id,requestor_id,receiver_id,shift_id,message,status) VALUES('{request_id}','{EMP}','{EMP}','{SHIFT}','OVERRIDE REQUEST: Continue session','pending')")
    approved=transition({'action':'approve_reentry','requestId':request_id},actor=ADMIN);assert approved['success'],approved
    claim();assert run("SELECT count(*) FROM notification_log WHERE type='attendance_reentry_approved'")=='1';claim();assert run("SELECT count(*) FROM notification_log WHERE type='attendance_reentry_approved'")=='1'
    check('a trusted existing re-entry approval creates one durable approval notice')
    reset();worker('plan')
    query="SET ROLE service_role;SELECT public.attendance_reminder_worker('{\"action\":\"claim\"}')"
    processes=[subprocess.Popen(PSQL+['-c',query],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True) for _ in range(2)]
    for process in processes:
        output,err=process.communicate(timeout=10);assert process.returncode==0,err
        assert json.loads(output.strip().splitlines()[-1])['success'],output
    assert run('SELECT count(*) FROM notification_log')=='1';assert run("SELECT count(*) FROM hrm_private.attendance_push_deliveries WHERE status='leased'")=='1'
    check('concurrent workers publish and lease a due employee/device notification once')
    print(json.dumps({'database':'disposable local PostgreSQL only','passed':len(checks),'checks':checks},indent=2))
finally:subprocess.run([BIN+'dropdb',*CONNECTION,NAME],check=True)
