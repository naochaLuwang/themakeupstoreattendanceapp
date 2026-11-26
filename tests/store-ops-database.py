"""Run: PYTHONDONTWRITEBYTECODE=1 python3 tests/store-ops-database.py"""
import sys
sys.dont_write_bytecode = True
from store_ops_fixture import database, literal
from attendance_fixture import EMP, ADMIN, MANAGER, OTHER, STORE, FOREIGN

with database() as sql:
    print('PASS all migrations apply on a clean database', flush=True)
    section = sql(f"INSERT INTO store_sections(name,store_id,created_by) VALUES('Display','{STORE}','{MANAGER}') RETURNING id",actor=MANAGER)
    foreign_section = sql(f"INSERT INTO store_sections(name,store_id,created_by) VALUES('Other','{FOREIGN}','{ADMIN}') RETURNING id",actor=ADMIN)
    sql(f"INSERT INTO store_sections(name,created_by) VALUES('Forbidden','{EMP}')",actor=EMP,error='row-level security')
    assert sql(f"SELECT count(*) FROM store_sections WHERE id='{foreign_section}'",actor=EMP)=='0'
    sql('SELECT * FROM store_sections',role='anon',error='permission denied')
    print('PASS manager-only section creation, store isolation and anonymous denial', flush=True)
    payload={'section_id':section,'status':'needs_restock','notes':'Two products needed','image_urls':[]}
    import json
    inspection=json.loads(sql(f"SELECT store_ops_shelf_save(NULL,{literal(payload)})",actor=EMP))
    assert inspection['store_id']==STORE and inspection['employee_id']==EMP
    bad={**payload,'section_id':foreign_section}
    sql(f"SELECT store_ops_shelf_save(NULL,{literal(bad)})",actor=EMP,error='authorized store')
    sql(f"UPDATE shelf_inspections SET reviewed_by='{EMP}' WHERE id='{inspection['id']}'",actor=EMP)
    assert sql(f"SELECT reviewed_by IS NULL FROM shelf_inspections WHERE id='{inspection['id']}'")=='t'
    sql(f"UPDATE shelf_inspections SET reviewed_by='{MANAGER}',reviewed_at=now() WHERE id='{inspection['id']}'",actor=MANAGER)
    assert sql(f"SELECT reviewed_by FROM shelf_inspections WHERE id='{inspection['id']}'")==MANAGER
    sql(f"SELECT store_ops_shelf_save('{inspection['id']}',{literal({**payload,'notes':'Updated'})})",actor=MANAGER)
    assert sql(f"SELECT reviewed_by IS NULL FROM shelf_inspections WHERE id='{inspection['id']}'")=='t'
    print('PASS inspection create, manager approval, editing and approval reset', flush=True)
    count=sql('SELECT count(*) FROM shelf_inspections')
    sql(f"SELECT store_ops_shelf_save(NULL,{literal({**payload,'image_urls':['/api/store-ops/media?path=shelf-inspection/'+OTHER+'/not-owned.jpg']})})",actor=EMP,error='Invalid inspection photo')
    assert sql('SELECT count(*) FROM shelf_inspections')==count
    print('PASS failed photo validation rolls back the entire inspection',flush=True)
    damage_payload={'barcode':'12345','product_name':'Lipstick','damage_type':'Broken','quantity':2,'mrp':250,'image_urls':[]}
    damage=json.loads(sql(f"SELECT store_ops_damage_save(NULL,{literal(damage_payload)})",actor=EMP))
    assert damage['status']=='pending' and damage['store_id']==STORE
    sql(f"UPDATE damage_reports SET status='approved',reviewed_by='{MANAGER}',reviewed_at=now() WHERE id='{damage['id']}'",actor=MANAGER)
    sql(f"SELECT store_ops_damage_save('{damage['id']}',{literal({**damage_payload,'quantity':3})})",actor=MANAGER)
    assert sql(f"SELECT status FROM damage_reports WHERE id='{damage['id']}'")=='pending'
    sql(f"SELECT store_ops_damage_save(NULL,{literal({**damage_payload,'quantity':-1})})",actor=EMP,error='damage_quantity_positive')
    print('PASS damage creation, approval reset after editing and negative quantity rejection',flush=True)
    task=sql(f"INSERT INTO tasks(title,assigned_to,created_by) VALUES('Clean','{EMP}','{MANAGER}') RETURNING id",actor=MANAGER)
    assert sql(f"WITH changed AS(UPDATE tasks SET status='completed' WHERE id='{task}' RETURNING id) SELECT count(*) FROM changed",actor=EMP)=='1'
    sql(f"UPDATE tasks SET title='Forged' WHERE id='{task}'",actor=EMP,error='Only the assigned task status')
    assert sql(f"SELECT count(*) FROM tasks WHERE id='{task}'",actor=OTHER)=='0'
    sql(f"INSERT INTO restock_requests(status,created_by) VALUES('approved','{EMP}')",actor=EMP,error='Manager approval')
    print('PASS assigned task completion, protected task fields and restock approval enforcement',flush=True)
    sql(f"UPDATE tasks SET is_recurring=true,recurrence_rule='weekly',status='pending' WHERE id='{task}'",actor=MANAGER)
    sql(f"UPDATE tasks SET status='completed' WHERE id='{task}'",actor=EMP)
    assert sql(f"SELECT count(*) FROM tasks WHERE recurrence_parent_id='{task}'")=='1'
    sql(f"UPDATE tasks SET status='pending' WHERE id='{task}'",actor=EMP)
    sql(f"UPDATE tasks SET status='completed' WHERE id='{task}'",actor=EMP)
    assert sql(f"SELECT count(*) FROM tasks WHERE recurrence_parent_id='{task}'")=='1'
    print('PASS recurring tasks create exactly one next occurrence across reopen/recomplete',flush=True)
    template=json.loads(sql(f"SELECT store_ops_checklist_template(NULL,{literal({'name':'Opening','type':'opening','store_id':STORE,'items':['Unlock store','Clean mirrors'],'requires_photo':True})})",actor=MANAGER))
    checklist=json.loads(sql(f"SELECT store_ops_checklist_start('{template['id']}')",actor=EMP))
    again=json.loads(sql(f"SELECT store_ops_checklist_start('{template['id']}')",actor=MANAGER))
    assert again['id']==checklist['id']
    assert sql(f"SELECT count(*) FROM daily_checklist_items WHERE daily_checklist_id='{checklist['id']}'")=='2'
    sql(f"UPDATE daily_checklists SET status='completed' WHERE id='{checklist['id']}'",actor=EMP,error='Complete all mandatory')
    sql(f"UPDATE daily_checklist_items SET is_completed=true WHERE daily_checklist_id='{checklist['id']}'",actor=EMP)
    sql(f"UPDATE daily_checklists SET status='completed' WHERE id='{checklist['id']}'",actor=EMP,error='required checklist photo')
    sql(f"UPDATE daily_checklists SET status='completed',photo_url='/api/store-ops/media?path=checklists/{MANAGER}/photo.jpg' WHERE id='{checklist['id']}'",actor=MANAGER)
    assert sql(f"SELECT completed_by FROM daily_checklists WHERE id='{checklist['id']}'")==MANAGER
    sql(f"SELECT store_ops_checklist_template('{template['id']}',{literal({'name':'New opening','type':'opening','items':['New item']})})",actor=MANAGER)
    assert sql(f"SELECT count(*) FROM daily_checklist_items WHERE daily_checklist_id='{checklist['id']}'")=='2'
    print('PASS checklist templates, idempotent start, mandatory items/photo and preserved snapshots',flush=True)
    audit_template=json.loads(sql(f"SELECT store_ops_audit_template({literal({'name':'Display','category':'display','store_id':STORE,'questions':[{'question':'Clean?','max_score':5}]})})",actor=MANAGER))
    sql(f"SELECT store_ops_audit_start('{audit_template['id']}')",actor=EMP,error='Manager permission')
    audit=json.loads(sql(f"SELECT store_ops_audit_start('{audit_template['id']}')",actor=MANAGER))
    sql(f"UPDATE audits SET status='completed' WHERE id='{audit['id']}'",actor=MANAGER,error='Save every audit answer')
    sql(f"UPDATE audit_answers SET score=99 WHERE audit_id='{audit['id']}'",actor=MANAGER,error='score must be within')
    sql(f"UPDATE audit_answers SET score=4 WHERE audit_id='{audit['id']}'",actor=MANAGER)
    sql(f"UPDATE audits SET status='completed',final_score=999 WHERE id='{audit['id']}'",actor=MANAGER)
    assert sql(f"SELECT final_score FROM audits WHERE id='{audit['id']}'")=='4.00'
    sql(f"UPDATE audit_answers SET score=3 WHERE audit_id='{audit['id']}'",actor=MANAGER,error='open audit')
    print('PASS manager-only audits, required answers, bounded scores, calculated totals and frozen history',flush=True)
    incident=json.loads(sql(f"SELECT store_ops_incident_save(NULL,{literal({'title':'Fixture broken','incident_type':'broken_fixture','priority':'high','image_urls':[]})})",actor=EMP))
    assert incident['store_id']==STORE and incident['status']=='open'
    assert sql(f"SELECT count(*) FROM incidents WHERE id='{incident['id']}'",actor=OTHER)=='0'
    sql(f"UPDATE incidents SET assigned_to='{OTHER}' WHERE id='{incident['id']}'",actor=MANAGER,error='Assignee must belong')
    restock_payload={'items':[{'barcode':'12345','product_name':'Lipstick','quantity_needed':3}],'notes':'Restock display'}
    restock=json.loads(sql(f"SELECT store_ops_restock_save(NULL,{literal(restock_payload)})",actor=EMP))
    sql(f"UPDATE restock_requests SET status='completed' WHERE id='{restock['id']}'",actor=MANAGER,error='Invalid restock status')
    sql(f"UPDATE restock_requests SET status='approved' WHERE id='{restock['id']}'",actor=MANAGER)
    assert sql(f"SELECT quantity_approved FROM restock_items WHERE restock_request_id='{restock['id']}'")=='3'
    sql(f"UPDATE restock_requests SET status='completed' WHERE id='{restock['id']}'",actor=MANAGER)
    assert sql(f"SELECT status FROM restock_requests WHERE id='{restock['id']}'")=='completed'
    count=sql('SELECT count(*) FROM restock_requests')
    sql(f"SELECT store_ops_restock_save(NULL,{literal({'items':[{'barcode':'1','product_name':'Invalid','quantity_needed':-1}]})})",actor=EMP,error='restock_quantities_positive')
    assert sql('SELECT count(*) FROM restock_requests')==count
    print('PASS incident store isolation, restock approval/completion sequence and transactional item validation',flush=True)
    today=sql("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date")
    report=json.loads(sql(f"SELECT store_ops_report('{today}','{today}','{STORE}')",actor=MANAGER))
    assert report['metrics']['inspections']==1 and report['metrics']['audit_score']==80
    assert len(report['daily'])==1 and report['damage_returns']==[]
    sql(f"SELECT store_ops_report('{today}','{today}','{FOREIGN}')",actor=MANAGER,error='not authorized')
    sql(f"SELECT store_ops_report('{today}','{today}',NULL)",actor=EMP,error='Manager permission')
    print('PASS real reporting aggregates, audit score, date windows and manager/store authorization',flush=True)
    assert int(sql(f"SELECT count(*) FROM notification_log WHERE user_id='{MANAGER}' AND type LIKE 'ops_%'",actor=MANAGER))>0
    assert sql(f"SELECT count(*) FROM notification_log WHERE user_id='{MANAGER}'",actor=EMP)=='0'
    sql(f"INSERT INTO store_operation_preferences(user_id,created_by,enabled,push_enabled) VALUES('{EMP}','{EMP}',true,true)",actor=EMP)
    device=sql(f"INSERT INTO attendance_notification_devices(user_id,provider,name,created_by) VALUES('{EMP}','fcm','Test Android','{EMP}') RETURNING id")
    sql(f"INSERT INTO hrm_private.attendance_notification_keys(device_id,installation_hash,credential_hash,credential,created_by) VALUES('{device}',repeat('a',64),repeat('b',64),'{{\"token\":\"fictional-registration-token\"}}','{EMP}')")
    sql(f"INSERT INTO tasks(title,assigned_to,created_by) VALUES('Notify employee','{EMP}','{MANAGER}')",actor=MANAGER)
    leases=json.loads(sql("SELECT store_ops_worker('{\"action\":\"claim\"}')"))['items']
    assert len(leases)==1
    lease=leases[0]
    delivery=json.loads(sql(f"SELECT store_ops_worker({literal({'action':'authorize','deliveryId':lease['id'],'leaseToken':lease['leaseToken']})})"))
    assert delivery['allowed'] and delivery['category']=='operations'
    sql(f"UPDATE store_operation_preferences SET push_enabled=false WHERE user_id='{EMP}'",actor=EMP)
    denied=json.loads(sql(f"SELECT store_ops_worker({literal({'action':'authorize','deliveryId':lease['id'],'leaseToken':lease['leaseToken']})})"))
    assert not denied['allowed']
    sql("SELECT store_ops_worker('{\"action\":\"claim\"}')",actor=EMP,error='permission denied')
    sql(f"INSERT INTO store_operations_settings(store_id,opening_due,closing_due,created_by) VALUES('{STORE}','00:00','00:00','{MANAGER}')",actor=MANAGER)
    sql("SELECT store_ops_worker('{\"action\":\"plan\"}')")
    count=sql("SELECT count(*) FROM notification_log")
    sql("SELECT store_ops_worker('{\"action\":\"plan\"}')")
    assert sql("SELECT count(*) FROM notification_log")==count
    print('PASS workflow notifications, recipient privacy, push consent recheck, worker authorization and scheduled deduplication',flush=True)
    sql(f"INSERT INTO storage.objects(bucket_id,name) VALUES('store-images','shelf-inspection/{EMP}/photo.jpg')",actor=EMP)
    sql(f"INSERT INTO storage.objects(bucket_id,name) VALUES('store-images','shelf-inspection/{OTHER}/forged.jpg')",actor=EMP,error='row-level security')
    assert sql("SELECT count(*) FROM storage.objects",actor=OTHER)=='0'
    sql("CREATE POLICY fictional_legacy_read ON storage.objects FOR SELECT USING(true)")
    assert sql("SELECT count(*) FROM storage.objects",actor=OTHER)=='0'
    assert sql("SELECT count(*) FROM storage.objects",role='anon')=='0'
    print('PASS storage upload ownership and private photo reads',flush=True)
    assert sql("SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN('tasks','shelf_inspections','daily_checklist_items')")=='3'
    print('PASS operations Realtime publication',flush=True)
    sql(f"INSERT INTO attendance_policies(store_id,enforce_engine,created_by) VALUES('{STORE}',true,'{ADMIN}')")
    shift=sql(f"INSERT INTO shifts(employee_id,start_time,end_time,shift_label,status) VALUES('{EMP}','{today}T10:00Z','{today}T18:00Z','Day','scheduled') RETURNING id")
    import uuid
    clock_in=json.loads(sql(f"SELECT attendance_transition({literal({'action':'clock_in','employeeId':EMP,'storeId':STORE,'shiftId':shift,'lat':24.804,'lng':93.943})},'{uuid.uuid4()}','app_dashboard')",actor=EMP))
    assert clock_in['success'],clock_in
    clock_out=json.loads(sql(f"SELECT attendance_transition({literal({'action':'clock_out','employeeId':EMP,'attendanceId':clock_in['data']['id'],'expectedVersion':clock_in['data']['version']})},'{uuid.uuid4()}','app_dashboard')",actor=EMP))
    assert clock_out['success'] and clock_out['data']['check_out']
    print('PASS existing attendance clock-in and GPS-free checkout after all operations migrations',flush=True)
