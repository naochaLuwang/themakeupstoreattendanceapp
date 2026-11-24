"""Station integration tests. ONLY disposable local PostgreSQL, no .env/network."""
import hashlib
import json
from pathlib import Path
import subprocess
import time
import uuid
from attendance_fixture import BASE_SCHEMA, EMP, ADMIN, OTHER, MANAGER, STORE, FOREIGN

ROOT=Path(__file__).resolve().parents[1]
BIN='/opt/homebrew/opt/postgresql@17/bin/'
CONNECTION=['-h','/private/tmp','-p','55439','-U','audit_owner']
NAME='station_test_'+uuid.uuid4().hex[:12]
PSQL=[BIN+'psql','-X','-qAt',*CONNECTION,'-d',NAME,'-v','ON_ERROR_STOP=1']
checks=[]
credential='a'*64
other_credential='b'*64
code='ABCD1234'
mac='A'*43

def digest(value):return hashlib.sha256(value.encode()).hexdigest()
def literal(value):return "'"+json.dumps(value).replace("'","''")+"'::jsonb"
def run(sql,actor=None,anonymous=False,error=None):
    if anonymous:sql='SET ROLE anon; '+sql
    elif actor:sql=f"SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{actor}',false); "+sql
    r=subprocess.run(PSQL+['-c',sql],capture_output=True,text=True)
    if error:assert r.returncode and error in r.stderr,r.stderr or r.stdout
    else:assert r.returncode==0,r.stderr
    return r.stdout.strip().splitlines()[-1] if r.stdout.strip() else ''
def check(name):checks.append(name);print('PASS:',name,flush=True)
def admin(command,actor=ADMIN,error=None):
    result=json.loads(run(f'SELECT public.attendance_station_admin({literal(command)})',actor=actor))
    if error:assert not result['success'] and error in result['error'],result
    else:assert result['success'],result
    return result

def device(action,station,secret=credential,request=None,token_hash=None,pairing_hash=None,error=None):
    arguments=[repr(action),repr(secret),'NULL' if station is None else repr(station),'NULL' if request is None else repr(request),'NULL' if token_hash is None else repr(token_hash),'NULL' if pairing_hash is None else repr(pairing_hash)]
    result=json.loads(run('SELECT public.attendance_station_device('+','.join(arguments)+')',anonymous=True))
    if error:assert not result['success'] and error in result['error'],result
    else:assert result['success'],result
    return result

def token_status(value,actor=EMP,error=None):
    result=json.loads(run('SELECT public.attendance_station_token_status('+repr(value)+')',actor=actor))
    if error:assert not result['success'] and error in result['error'],result
    else:assert result['success'],result
    return result

settings={'store_id':STORE,'name':'Billing counter','refresh_seconds':30,'validity_seconds':45,'heartbeat_seconds':15,'offline_seconds':60,'credential_days':90}
def update(station,**changes):
    current=admin({'action':'list'})['data']['stations'];row=next(s for s in current if s['id']==station)
    command={'action':'update','stationId':station,'expectedUpdatedAt':row['updated_at'],'active':changes.pop('active',row['active']),'settings':{**{key:row[key] for key in settings},**changes}}
    return admin(command)

subprocess.run([BIN+'createdb',*CONNECTION,NAME],check=True)
try:
    run(BASE_SCHEMA)
    for migration in ['005_shift_attendance_lock.sql','006_attendance_engine.sql','007_attendance_stations.sql','007_attendance_stations.sql']:
        r=subprocess.run(PSQL+['-f',str(ROOT/'supabase/migrations'/migration)],capture_output=True,text=True);assert r.returncode==0,r.stderr
    check('migrations apply in order and station migration reruns safely')
    admin({'action':'create','settings':settings},actor=EMP,error='STATION_FORBIDDEN')
    admin({'action':'create','settings':settings},actor=MANAGER,error='STATION_FORBIDDEN')
    station=admin({'action':'create','settings':settings})['data']['id']
    second=admin({'action':'create','settings':{**settings,'name':'Entrance display'}})['data']['id']
    assert run('SELECT count(*) FROM attendance_stations',actor=EMP)=='0'
    assert run('SELECT count(*) FROM attendance_stations',actor=ADMIN)=='2'
    run("SELECT public.attendance_station_admin('{}')",anonymous=True,error='permission denied')
    run("SELECT * FROM hrm_private.attendance_station_keys",actor=ADMIN,error='permission denied')
    run("UPDATE attendance_stations SET active=false",actor=ADMIN,error='permission denied')
    check('only administrators manage stations; raw writes and credential-table access are denied')
    device('issue',station,error='STATION_UNAUTHORIZED',request=str(uuid.uuid4()),token_hash=digest(mac))
    pending=device('start',station,pairing_hash=digest(code))['data'];device_id=pending['device']['id']
    assert pending['state']=='pending' and 'created_by' not in pending['device'] and 'created_by' not in pending['station']
    assert 'approved_by' not in pending['device']
    assert run('SELECT credential_hash FROM hrm_private.attendance_station_keys')==digest(credential)
    assert run('SELECT pairing_hash FROM hrm_private.attendance_station_keys')==digest(code)
    assert credential not in json.dumps(admin({'action':'list'}))
    device('issue',station,error='STATION_UNAUTHORIZED',request=str(uuid.uuid4()),token_hash=digest(mac))
    check('anonymous displays receive a short-lived pairing challenge, never raw stored credentials or employee metadata')
    admin({'action':'pair','stationId':second,'code':code,'deviceName':'Billing PC'},error='STATION_PAIR_EXPIRED')
    admin({'action':'pair','stationId':station,'code':'ZZZZ1234','deviceName':'Billing PC'},error='STATION_PAIR_EXPIRED')
    admin({'action':'pair','stationId':station,'code':code,'deviceName':'Billing PC'})
    admin({'action':'pair','stationId':station,'code':code,'deviceName':'Billing PC'},error='STATION_PAIR_EXPIRED')
    assert run('SELECT pairing_hash IS NULL FROM hrm_private.attendance_station_keys')=='t'
    device('status',second,error='STATION_WRONG_DISPLAY')
    check('pairing is station-bound and single-use; another station cannot reuse the browser credential')
    status=device('heartbeat',station)['data'];assert status['device']['last_seen_at']
    request=str(uuid.uuid4());issued=device('issue',station,request=request,token_hash=digest(mac))['data']
    assert issued['scanEnabled'] is False
    value='hrm.attendance.v1.'+issued['tokenId']+'.'+mac
    assert token_status(value)['data']['stationId']==station
    assert token_status(value,actor=MANAGER)['data']['storeId']==STORE
    assert run('SELECT count(*) FROM attendance')=='0'
    check('authorized displays issue branch-bound tokens that multiple authenticated employees can verify without changing attendance')
    assert device('issue',station,request=request,token_hash=digest(mac))['data']['tokenId']==issued['tokenId']
    assert device('status',station)['data']['requestId']==request
    assert run(f"SELECT issued_count FROM attendance_stations WHERE id='{station}'")=='1'
    limited=json.loads(run("SELECT public.attendance_station_device('issue',"+repr(credential)+','+repr(station)+','+repr(str(uuid.uuid4()))+','+repr(digest('B'*43))+',NULL)',anonymous=True))
    assert limited['code']=='RATE_LIMITED'
    run(f"UPDATE hrm_private.attendance_station_tokens SET created_at=clock_timestamp()-interval '29 seconds' WHERE device_id='{device_id}'")
    near_due=json.loads(run("SELECT public.attendance_station_device('issue','"+credential+"','"+station+"','"+str(uuid.uuid4())+"','"+digest(mac)+"',NULL)",anonymous=True))
    assert near_due['code']=='RATE_LIMITED' and near_due['retryAfter']==1,near_due
    check('lost-response retries and refresh recovery reuse one code; early rotations are rate-limited')
    token_status(value[:-1]+'B',error='STATION_TOKEN_EXPIRED')
    token_status(value.replace('v1','v2'),error='STATION_TOKEN_INVALID')
    token_status(value,actor=OTHER,error='STATION_WRONG_BRANCH')
    run('SELECT public.attendance_station_token_status('+repr(value)+')',anonymous=True,error='permission denied')
    run(f"UPDATE hrm_private.attendance_station_tokens SET expires_at=clock_timestamp()-interval '1 second' WHERE id='{issued['tokenId']}'")
    token_status(value,error='STATION_TOKEN_EXPIRED')
    device('issue',station,request=request,token_hash=digest(mac),error='STATION_TOKEN_EXPIRED')
    check('tampering, wrong purpose/version, unauthorized branch, anonymous use and expired-code reuse fail')
    # Advance the fixture's last issuance, not the server wall clock.
    run(f"UPDATE hrm_private.attendance_station_tokens SET created_at=clock_timestamp()-interval '31 seconds' WHERE device_id='{device_id}'")
    fresh=device('issue',station,request=str(uuid.uuid4()),token_hash=digest(mac))['data'];fresh_value='hrm.attendance.v1.'+fresh['tokenId']+'.'+mac
    admin({'action':'revoke','stationId':station,'deviceId':device_id})
    device('issue',station,request=str(uuid.uuid4()),token_hash=digest(mac),error='STATION_REVOKED')
    token_status(fresh_value,error='STATION_REVOKED')
    check('revoking a display immediately invalidates its credential and still-unexpired QR codes')
    # Pair a replacement browser; test stale edits and atomic rollback.
    pending=device('start',station,secret=other_credential,pairing_hash=digest('EFGH5678'))['data'];replacement=pending['device']['id']
    admin({'action':'pair','stationId':station,'code':'EFGH5678','deviceName':'Replacement PC'})
    old=next(s for s in admin({'action':'list'})['data']['stations'] if s['id']==station)
    update(station,name='Billing station')
    admin({'action':'update','stationId':station,'settings':settings,'active':True,'expectedUpdatedAt':old['updated_at']},error='STATION_STALE')
    current=next(s for s in admin({'action':'list'})['data']['stations'] if s['id']==station)
    result=admin({'action':'update','stationId':station,'settings':{**settings,'store_id':FOREIGN,'validity_seconds':1},'active':True,'expectedUpdatedAt':current['updated_at']},error='STATION_INVALID')
    assert run(f"SELECT revoked_at IS NULL FROM attendance_station_devices WHERE id='{replacement}'")=='t'
    assert run(f"SELECT store_id FROM attendance_stations WHERE id='{station}'")==STORE
    check('stale management forms fail and invalid edits roll back device revocation with station changes')
    update(station,active=False);update(station,active=True)
    device('status',station,secret=other_credential,error='STATION_REVOKED')
    check('reactivating a station never resurrects revoked browser credentials')
    device('forget',None,secret=other_credential)
    third='c'*64;pending=device('start',station,secret=third,pairing_hash=digest('JKMN1234'))['data']
    run(f"UPDATE attendance_station_devices SET pairing_expires_at=clock_timestamp()-interval '1 second' WHERE id='{pending['device']['id']}'")
    admin({'action':'pair','stationId':station,'code':'JKMN1234','deviceName':'Late PC'},error='STATION_PAIR_EXPIRED')
    check('expired pairing codes cannot be authorized and a revoked browser can unpair itself')
    # A station can have several independent displays in the same branch.
    fourth='d'*64;pending=device('start',station,secret=fourth,pairing_hash=digest('MNPQ1234'))['data']
    admin({'action':'pair','stationId':station,'code':'MNPQ1234','deviceName':'Counter tablet'})
    nonce=str(uuid.uuid4());sql="SELECT public.attendance_station_device('issue',"+repr(fourth)+','+repr(station)+','+repr(nonce)+','+repr(digest(mac))+',NULL)'
    first=subprocess.Popen(PSQL+['-c','SET ROLE anon; BEGIN; '+sql+'; SELECT pg_sleep(0.3); COMMIT;'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    time.sleep(.1);second_proc=subprocess.Popen(PSQL+['-c','SET ROLE anon; '+sql],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    for proc in [first,second_proc]:
        output,error=proc.communicate(timeout=10);assert proc.returncode==0,error
    assert run(f"SELECT count(*) FROM hrm_private.attendance_station_tokens WHERE request_id='{nonce}'")=='1'
    update(station,store_id=FOREIGN)
    device('status',station,secret=fourth,error='STATION_REVOKED')
    assert run(f"SELECT count(*) FROM attendance_audit_events WHERE station_id='{station}' AND event_type='station_pair'")=='3'
    check('concurrent issuance is idempotent and moving branches revokes all displays with audit history')
    print(json.dumps({'database':'disposable local PostgreSQL only','passed':len(checks),'checks':checks},indent=2))
finally:subprocess.run([BIN+'dropdb',*CONNECTION,'--if-exists',NAME],check=True)
