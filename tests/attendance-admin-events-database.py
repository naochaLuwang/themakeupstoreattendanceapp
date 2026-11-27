"""Focused attendance-to-admin queue checks; fictional disposable PostgreSQL only."""
import json
import sys
import uuid
from datetime import datetime, timezone

sys.dont_write_bytecode = True

from attendance_fixture import ADMIN, EMP, MANAGER, OTHER, STORE, FOREIGN
from store_ops_fixture import database, literal

with database() as sql:
    today = datetime.now(timezone.utc).date().isoformat()
    foreign_admin = str(uuid.uuid4())
    sql(f"INSERT INTO profiles(id,role,store_id,full_name) VALUES('{foreign_admin}','admin','{FOREIGN}','Other admin')")
    sql(f"INSERT INTO attendance_policies(store_id,enforce_engine,created_by) VALUES('{STORE}',true,'{ADMIN}')")
    shift = sql(f"INSERT INTO shifts(employee_id,start_time,end_time,status) VALUES('{EMP}','{today}T10:00Z','{today}T18:00Z','scheduled') RETURNING id")
    sql(f"INSERT INTO store_operation_preferences(user_id,enabled,push_enabled,created_by) VALUES('{ADMIN}',true,true,'{ADMIN}')")
    device = sql(f"INSERT INTO attendance_notification_devices(user_id,provider,name,created_by) VALUES('{ADMIN}','fcm','Test phone','{ADMIN}') RETURNING id")
    sql(f"INSERT INTO hrm_private.attendance_notification_keys(device_id,installation_hash,credential_hash,credential) VALUES('{device}','{'a'*64}','{'b'*64}',{literal({'token':'A'*100})})")

    def transition(command, operation=None, actor=EMP):
        return json.loads(sql(f"SELECT attendance_transition({literal(command)},'{operation or uuid.uuid4()}','app_dashboard')", actor=actor))

    def notices():
        return int(sql("SELECT count(*) FROM notification_log WHERE type IN ('ops_attendance_clock_in','ops_attendance_clock_out')"))

    command = {'action': 'clock_in', 'employeeId': EMP, 'storeId': STORE, 'shiftId': shift, 'lat': 24.804, 'lng': 93.943}
    invalid = transition({**command, 'lat': 0, 'lng': 0})
    assert not invalid['success'] and notices() == 0
    operation = str(uuid.uuid4())
    started = transition(command, operation)
    assert started['success'] and notices() == 1, started
    assert sql(f"SELECT user_id='{ADMIN}' AND body LIKE '%Test employee checked in%' AND body LIKE '%IST' AND link='/admin/logs' FROM notification_log WHERE type='ops_attendance_clock_in'") == 't'
    assert sql("SELECT count(*) FROM store_ops_private.push_deliveries") == '1'
    print('PASS successful engine check-in queues one admin push; excludes other branches and managers', flush=True)

    assert transition(command, operation)['success'] and notices() == 1
    assert transition(command)['changed'] is False and notices() == 1
    assert sql("SELECT count(*) FROM store_ops_private.push_deliveries") == '1'
    print('PASS failed attempts, operation replays and already-checked-in requests do not duplicate alerts', flush=True)

    session = started['data']
    closed = transition({'action':'clock_out', 'employeeId':EMP, 'attendanceId':session['id'], 'expectedVersion':session['version']})
    assert closed['success'] and notices() == 2, closed
    assert sql("SELECT count(*) FROM store_ops_private.push_deliveries") == '2'
    corrected = transition({'action':'admin_update', 'attendanceId':session['id'], 'updates':{'check_in':session['check_in']}, 'reason':'Test correction'}, actor=ADMIN)
    assert corrected['success'] and notices() == 2, corrected
    print('PASS successful checkout creates a separate alert; admin corrections do not', flush=True)

    assert sql("SELECT count(*) FROM notification_log", actor=OTHER) == '0'
    sql("SELECT hrm_private.notify_admin_attendance_event()", actor=EMP, error='permission denied')
    print('PASS employee cannot read admin history or invoke the private alert function', flush=True)

    claimed = json.loads(sql("SELECT store_ops_worker('{\"action\":\"claim\"}')"))['items']
    assert len(claimed) == 2
    item = claimed[0]
    authorize = {'action':'authorize', 'deliveryId':item['id'], 'leaseToken':item['leaseToken']}
    ready = json.loads(sql(f"SELECT store_ops_worker({literal(authorize)})"))
    assert ready['allowed'] and ready['category'] == 'attendance_event' and ready['url'] == '/admin/logs'
    sql(f"UPDATE profiles SET role='manager',store_id='{STORE}' WHERE id='{ADMIN}'")
    assert json.loads(sql(f"SELECT store_ops_worker({literal(authorize)})"))['allowed'] is False
    sql(f"UPDATE profiles SET role='admin',store_id=NULL WHERE id='{ADMIN}'")
    print('PASS worker authorizes attendance payloads and suppresses delivery after admin demotion', flush=True)

    # Model the completed operation emitted by Smart Scan. The same engine
    # receipt hook is used, independently of the HTTP entry point.
    sql(f"UPDATE store_operation_preferences SET enabled=false WHERE user_id='{ADMIN}'")
    response = {'success':True, 'changed':True, 'data':{'id':session['id']}}
    def receipt():
        return sql(f"INSERT INTO attendance_operations(employee_id,operation_id,command_hash,action,entry_point,transaction_id,response,created_by) VALUES('{EMP}','{uuid.uuid4()}','fixture','clock_out','smart_scan',txid_current(),{literal(response)},'{EMP}') RETURNING id")
    receipt()
    assert notices() == 2
    sql(f"UPDATE store_operation_preferences SET enabled=true,push_enabled=false WHERE user_id='{ADMIN}'")
    receipt()
    assert notices() == 3 and sql("SELECT count(*) FROM store_ops_private.push_deliveries") == '2'
    print('PASS Smart Scan receipts use the same hook; disabled alerts and push opt-out are respected', flush=True)
