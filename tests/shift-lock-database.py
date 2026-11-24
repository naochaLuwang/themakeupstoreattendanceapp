"""Integration tests for migration 005, using ONLY a disposable local database.

Requires PostgreSQL 17 running on /private/tmp socket, port 55439, owner audit_owner.
No .env files, Supabase credentials, network hosts or production data are used.
"""
import json
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
BIN = '/opt/homebrew/opt/postgresql@17/bin/'
CONNECTION = ['-h', '/private/tmp', '-p', '55439', '-U', 'audit_owner']
NAME = 'shift_lock_test_' + uuid.uuid4().hex[:12]
OWNER = [BIN+'psql', '-X', '-qAt', *CONNECTION, '-d', NAME, '-v', 'ON_ERROR_STOP=1']
EMP = '00000000-0000-4000-8000-000000000001'
PEER = '00000000-0000-4000-8000-000000000002'
ADMIN = '00000000-0000-4000-8000-000000000003'
MANAGER = '00000000-0000-4000-8000-000000000004'
OTHER = '00000000-0000-4000-8000-000000000005'
SHIFT = '00000000-0000-4000-8000-000000000010'
TARGET = '00000000-0000-4000-8000-000000000011'
REQUEST = '00000000-0000-4000-8000-000000000020'
checks = []

def run(sql, error=None, actor=None):
    if actor:
        sql = f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{actor}',false); " + sql
    result = subprocess.run(OWNER + ['-c', sql], capture_output=True, text=True)
    if error:
        assert result.returncode and error in result.stderr, result.stderr or result.stdout
    else:
        assert result.returncode == 0, result.stderr
    return result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ''

def check(name):
    checks.append(name)
    print('PASS:', name, flush=True)

def reset():
    run(f"""
    TRUNCATE public.swap_requests, public.attendance, public.shifts CASCADE;
    INSERT INTO public.shifts(id,employee_id,start_time,end_time,shift_label,status) VALUES
    ('{SHIFT}','{EMP}','{TODAY}T10:00:00Z','{TODAY}T18:00:00Z','Day','scheduled'),
    ('{TARGET}','{EMP}','{TOMORROW}T12:00:00Z','{TOMORROW}T20:00:00Z','Late','scheduled');
    """)

def attend(shift=SHIFT, employee=EMP, date=None, closed=False):
    date = date or TODAY
    return run(f"INSERT INTO public.attendance(employee_id,shift_id,check_in,check_out) VALUES ('{employee}',{repr(shift) if shift else 'NULL'},'{date}T04:30:00Z',{'NULL' if not closed else repr(date+'T05:30:00Z')}) RETURNING id")

def request(message=None):
    message = message or f'Shift Change: Move from Day to Late for {TODAY}'
    run(f"INSERT INTO public.swap_requests(id,requestor_id,receiver_id,shift_id,message,status) VALUES ('{REQUEST}','{EMP}','{EMP}','{SHIFT}','{message}','pending')", actor=EMP)

def rows():
    return json.loads(run('SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.shifts s'))

def commit(changes, expected, req=None, decision=None, actor=ADMIN, error=None):
    def literal(value): return "'"+json.dumps(value).replace("'","''")+"'::jsonb"
    run(f"SELECT public.commit_shift_changes({literal(changes)},{literal(expected)},{repr(req) if req else 'NULL'},{repr(decision) if decision else 'NULL'})", actor=actor, error=error)

subprocess.run([BIN+'createdb', *CONNECTION, NAME], check=True)
try:
    run(f"""
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE profiles(id uuid PRIMARY KEY,role text,store_id uuid);
    CREATE TABLE shifts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),employee_id uuid REFERENCES profiles(id),start_time timestamptz NOT NULL,end_time timestamptz,shift_label text,status text,created_at timestamptz DEFAULT now());
    CREATE TABLE attendance(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),employee_id uuid REFERENCES profiles(id),shift_id uuid REFERENCES shifts(id),check_in timestamptz NOT NULL,check_out timestamptz);
    CREATE TABLE swap_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),requestor_id uuid REFERENCES profiles(id),receiver_id uuid REFERENCES profiles(id),shift_id uuid REFERENCES shifts(id),message text,note text,status text CHECK(status IN ('pending','approved','declined','cancelled')),created_at timestamptz DEFAULT now());
    INSERT INTO profiles VALUES ('{EMP}','employee','10000000-0000-4000-8000-000000000001'),('{PEER}','employee','10000000-0000-4000-8000-000000000001'),('{ADMIN}','admin',null),('{MANAGER}','manager','10000000-0000-4000-8000-000000000001'),('{OTHER}','employee','10000000-0000-4000-8000-000000000002');
    GRANT USAGE ON SCHEMA public,auth TO authenticated;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    """)
    TODAY = run("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date")
    TOMORROW = run("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date+1")
    run(f"INSERT INTO shifts(id,employee_id,start_time,end_time,shift_label,status) VALUES('{SHIFT}','{EMP}','{TODAY}T10:00Z','{TODAY}T18:00Z','Day','scheduled')")
    attend(closed=True)
    for _ in range(2):
        result = subprocess.run(OWNER+['-f',str(ROOT/'supabase/migrations/005_shift_attendance_lock.sql')],capture_output=True,text=True)
        assert result.returncode == 0,result.stderr
    assert run(f"SELECT attendance_started_at IS NOT NULL FROM shifts WHERE id='{SHIFT}'") == 't'
    check('migration applies, reruns, and backfills completed historical attendance')

    reset(); attend()
    for mutation in [f"UPDATE shifts SET start_time=start_time+interval '1 hour' WHERE id='{SHIFT}'",f"UPDATE shifts SET shift_label='Other' WHERE id='{SHIFT}'",f"UPDATE shifts SET employee_id='{PEER}' WHERE id='{SHIFT}'",f"DELETE FROM shifts WHERE id='{SHIFT}'"]:
        run(mutation,error='SHIFT_ATTENDANCE_LOCKED',actor=ADMIN)
    check('worked time, label, employee and delete mutations are rejected by database triggers')
    run(f"UPDATE attendance SET check_out=now(); UPDATE shifts SET shift_label=shift_label WHERE id='{SHIFT}'")
    run(f"UPDATE shifts SET shift_label='Other' WHERE id='{SHIFT}'",error='SHIFT_ATTENDANCE_LOCKED')
    check('checkout retains the lock and harmless no-op updates remain allowed')
    run('DELETE FROM attendance')
    run(f"UPDATE shifts SET start_time=start_time+interval '1 hour' WHERE id='{SHIFT}'",error='SHIFT_ATTENDANCE_LOCKED')
    run(f"UPDATE shifts SET attendance_started_at=NULL WHERE id='{SHIFT}'",error='SHIFT_ATTENDANCE_LOCKED')
    check('attendance deletion or a direct attempt to clear the marker cannot unlock a worked shift')

    reset(); attend()
    run(f"INSERT INTO swap_requests(requestor_id,receiver_id,shift_id,message,status) VALUES('{EMP}','{EMP}','{SHIFT}','Shift Change: Move from Day to Late for {TODAY}','pending')",actor=EMP,error='SHIFT_ATTENDANCE_LOCKED')
    run(f"INSERT INTO swap_requests(requestor_id,receiver_id,shift_id,message,status) VALUES('{EMP}','{EMP}','{TARGET}','Shift Change: Move from Late to Day for {TOMORROW}','pending')",actor=EMP)
    check('worked request creation is blocked while a future unworked shift remains requestable')

    reset(); request(); attend()
    current=rows(); changed={**current[0],'shift_label':'Changed'}
    commit([changed],[current[0]],REQUEST,'approved',error='SHIFT_ATTENDANCE_LOCKED')
    assert run(f"SELECT status FROM swap_requests WHERE id='{REQUEST}'")=='pending'
    check('request created before clock-in cannot be approved after attendance begins')

    reset(); attend(TARGET,date=TOMORROW)
    request_message=f'Swap my shift on {TODAY} with shift on {TOMORROW}.'
    run(f"INSERT INTO swap_requests(requestor_id,receiver_id,shift_id,message,status) VALUES('{EMP}','{EMP}','{SHIFT}','{request_message}','pending')",actor=EMP,error='SHIFT_ATTENDANCE_LOCKED')
    current=rows(); first={**current[0],'shift_label':'Must roll back'}; second={**current[1],'shift_label':'Blocked'}
    commit([first,second],current,error='SHIFT_ATTENDANCE_LOCKED')
    assert rows()[0]['shift_label']=='Day'
    check('worked target is checked and a failed second batch update rolls back the first update')

    reset()
    run(f"UPDATE shifts SET employee_id='{PEER}',start_time='{TODAY}T12:00Z',end_time='{TODAY}T20:00Z' WHERE id='{TARGET}'")
    run(f"INSERT INTO swap_requests(id,requestor_id,receiver_id,shift_id,message,status) VALUES('{REQUEST}','{EMP}','{PEER}','{SHIFT}','Peer swap','pending')",actor=EMP)
    attend(TARGET,employee=PEER)
    current=rows()
    commit([{**current[0],'employee_id':PEER},{**current[1],'employee_id':EMP}],current,REQUEST,'approved',error='SHIFT_ATTENDANCE_LOCKED')
    assert rows()[0]['employee_id']==EMP and rows()[1]['employee_id']==PEER
    check('a peer who clocks in after submission blocks the entire peer exchange')

    reset()
    run(f"UPDATE shifts SET employee_id='{PEER}',start_time='{TODAY}T12:00Z',end_time='{TODAY}T20:00Z' WHERE id='{TARGET}'")
    run(f"INSERT INTO swap_requests(id,requestor_id,receiver_id,shift_id,message,status) VALUES('{REQUEST}','{EMP}','{PEER}','{SHIFT}','Peer swap','pending')",actor=EMP)
    current=rows()
    commit([{**current[0],'employee_id':PEER},{**current[1],'employee_id':EMP}],current,REQUEST,'approved')
    assert rows()[0]['employee_id']==PEER and rows()[1]['employee_id']==EMP
    check('an eligible unworked peer exchange still commits both employee assignments')

    reset(); request(); current=rows()
    commit([{**current[0],'shift_label':'Approved'}],[current[0]],REQUEST,'approved')
    assert run(f"SELECT status FROM swap_requests WHERE id='{REQUEST}'")=='approved'
    assert rows()[0]['shift_label']=='Approved'
    commit([{**current[0],'shift_label':'Replay'}],[current[0]],REQUEST,'approved',error='SHIFT_REQUEST_STALE')
    check('valid approval commits once and repeated approval is rejected')

    reset(); request(); run(f"UPDATE swap_requests SET status='cancelled' WHERE id='{REQUEST}'",actor=EMP)
    current=rows(); commit([{**current[0],'shift_label':'Cancelled'}],[current[0]],REQUEST,'approved',error='SHIFT_REQUEST_STALE')
    check('a stale admin tab cannot approve a cancelled request')

    reset(); request(); old=rows(); run(f"UPDATE shifts SET shift_label='Edited elsewhere' WHERE id='{SHIFT}'")
    commit([{**old[0],'shift_label':'Stale'}],[old[0]],error='SHIFT_SCHEDULE_STALE')
    current=rows(); commit([{**current[0],'shift_label':'Stale request'}],[current[0]],REQUEST,'approved',error='SHIFT_SCHEDULE_STALE')
    check('both stale publisher snapshots and changed request snapshots are rejected')

    reset(); run(f"DELETE FROM shifts WHERE id='{TARGET}'")
    request(f'Request day off on {TODAY} (working day) and instead work on my off day {TOMORROW}.')
    run(f"INSERT INTO shifts(id,employee_id,start_time,end_time,shift_label,status) VALUES('{TARGET}','{EMP}','{TOMORROW}T12:00Z','{TOMORROW}T20:00Z','New assignment','scheduled')")
    current=rows()
    commit([{**current[0],'shift_label':'Unexpected exchange'},{**current[1],'shift_label':'Unexpected exchange'}],current,REQUEST,'approved',error='SHIFT_SCHEDULE_STALE')
    check('an off-day request becomes stale if another shift is added to its target date')

    reset(); request()
    run(f"UPDATE swap_requests SET message='Different' WHERE id='{REQUEST}'",actor=EMP,error='SHIFT_REQUEST_STALE')
    run(f"INSERT INTO swap_requests(requestor_id,receiver_id,shift_id,message,status) SELECT requestor_id,receiver_id,shift_id,message,'pending' FROM swap_requests WHERE id='{REQUEST}'",actor=EMP,error='already pending')
    check('submitted request contents are immutable and duplicate pending requests are rejected')

    reset(); current=rows()
    commit([{**current[0],'shift_label':'Employee edit'}],[current[0]],actor=EMP,error='Only an administrator or manager')
    commit([{**current[0],'employee_id':OTHER}],[current[0]],actor=MANAGER,error='own store')
    commit([{**current[0],'shift_label':'Manager edit'}],[current[0]],actor=MANAGER)
    run("SET ROLE anon; SELECT public.commit_shift_changes('[]','[]')",error='permission denied')
    check('RPC enforces staff roles and manager store scope; anonymous callers cannot execute it')

    reset(); attend(shift=None); run('DELETE FROM attendance')
    run(f"UPDATE shifts SET shift_label='Unlinked escape' WHERE id='{SHIFT}'",error='SHIFT_ATTENDANCE_LOCKED')
    check('legacy/unlinked attendance permanently locks the matching employee business day')

    reset()
    run(f"INSERT INTO attendance(employee_id,shift_id,check_in) VALUES('{PEER}','{SHIFT}','{TODAY}T04:30Z')",error='SHIFT_SCHEDULE_STALE')
    check('attendance cannot be attached to another employee’s shift')

    reset()
    slow = subprocess.Popen(OWNER+['-c',f"BEGIN; INSERT INTO attendance(employee_id,shift_id,check_in) VALUES('{EMP}','{SHIFT}','{TODAY}T04:30Z'); SELECT pg_sleep(0.7); COMMIT"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    time.sleep(0.2)
    run(f"UPDATE shifts SET shift_label='Concurrent edit' WHERE id='{SHIFT}'",error='SHIFT_ATTENDANCE_LOCKED')
    _,stderr=slow.communicate(); assert slow.returncode==0,stderr
    check('concurrent clock-in wins: schedule mutation waits and then sees the permanent lock')

    reset()
    slow = subprocess.Popen(OWNER+['-c',f"BEGIN; UPDATE shifts SET start_time=start_time+interval '1 day',end_time=end_time+interval '1 day' WHERE id='{SHIFT}'; SELECT pg_sleep(0.7); COMMIT"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    time.sleep(0.2)
    run(f"INSERT INTO attendance(employee_id,shift_id,check_in) VALUES('{EMP}','{SHIFT}','{TODAY}T04:30Z')",error='SHIFT_SCHEDULE_STALE')
    _,stderr=slow.communicate(); assert slow.returncode==0,stderr
    assert run('SELECT count(*) FROM attendance')=='0'
    check('concurrent schedule move wins: stale clock-in is rejected rather than mislinked')

    reset(); run('TRUNCATE shifts CASCADE')
    slow = subprocess.Popen(OWNER+['-c',f"BEGIN; INSERT INTO attendance(employee_id,shift_id,check_in) VALUES('{EMP}',NULL,'{TODAY}T04:30Z'); SELECT pg_sleep(0.7); COMMIT"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    time.sleep(0.2)
    run(f"INSERT INTO shifts(id,employee_id,start_time,end_time,shift_label,status) VALUES('{SHIFT}','{EMP}','{TODAY}T10:00Z','{TODAY}T18:00Z','Late creation','scheduled')",error='SHIFT_ATTENDANCE_LOCKED')
    _,stderr=slow.communicate(); assert slow.returncode==0,stderr
    check('concurrent unlinked clock-in also prevents creating a schedule after attendance starts')

    reset(); attend(closed=True)
    run(f"INSERT INTO swap_requests(requestor_id,receiver_id,shift_id,message,status) VALUES('{EMP}','{EMP}','{SHIFT}','OVERRIDE REQUEST: Accidental check-out on {TODAY}','pending')",actor=EMP)
    check('separate accidental-checkout request workflow remains available')
    print(json.dumps({'passed':len(checks),'checks':checks},indent=2))
finally:
    subprocess.run([BIN+'dropdb',*CONNECTION,NAME],check=True)
