"""Reproduce and repair the legacy approval trigger using fictional local data."""
import json
import sys
import uuid
from pathlib import Path

sys.dont_write_bytecode = True
from attendance_fixture import ADMIN, EMP, OTHER, STORE, FOREIGN
from store_ops_fixture import database, literal

root = Path(__file__).resolve().parents[1]
repair = '20261128111936_remove_legacy_swap_approval_trigger.sql'
migrations = [path.name for path in sorted((root / 'supabase/migrations').glob('*.sql')) if path.name != repair]

with database(migrations) as sql:
    sql("""CREATE OR REPLACE FUNCTION public.handle_swap_approval() RETURNS trigger LANGUAGE plpgsql AS $body$
    BEGIN
      IF NEW.status='approved' AND OLD.status='pending' THEN
        UPDATE shifts SET employee_id=NEW.receiver_id WHERE id=NEW.shift_id;
      END IF;
      RETURN NEW;
    END $body$;
    CREATE TRIGGER old_swap_approval AFTER UPDATE OF status ON public.swap_requests
    FOR EACH ROW EXECUTE FUNCTION public.handle_swap_approval();""")
    today = sql("SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date")
    tomorrow = sql("SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date+1)::text")
    worked = str(uuid.uuid4())
    future = str(uuid.uuid4())
    sql(f"INSERT INTO public.shifts(id,employee_id,start_time,end_time,shift_label,status) VALUES('{worked}','{EMP}','{today}T10:00Z','{today}T18:00Z','Morning shift','scheduled'),('{future}','{OTHER}','{tomorrow}T10:00Z','{tomorrow}T18:00Z','Morning shift','scheduled')")
    sql(f"INSERT INTO public.attendance(employee_id,store_id,shift_id,check_in,check_out) VALUES('{EMP}','{STORE}','{worked}',now()-interval '2 hours',now()-interval '1 hour')")
    override = sql(f"INSERT INTO public.swap_requests(requestor_id,receiver_id,shift_id,message,status) VALUES('{EMP}','{EMP}','{worked}','OVERRIDE REQUEST: Accidental check-out on {today}','pending') RETURNING id", actor=EMP)
    exchange = sql(f"INSERT INTO public.swap_requests(requestor_id,receiver_id,shift_id,message,status) VALUES('{OTHER}','{OTHER}','{future}','Shift Change: Move from Morning shift to Evening shift for {tomorrow}','pending') RETURNING id", actor=OTHER)
    command = literal({'action': 'approve_reentry', 'requestId': override})
    before = json.loads(sql(f"SELECT public.attendance_transition({command},'{uuid.uuid4()}','admin_console')", actor=ADMIN))
    assert not before['success'] and before['code'] == '42P01', before
    approval = f"SELECT public.commit_shift_changes(jsonb_build_array(jsonb_build_object('id',id,'employee_id',employee_id,'start_time',start_time,'end_time',end_time,'shift_label','Evening shift','status',status)),jsonb_build_array(jsonb_build_object('id',id,'employee_id',employee_id,'start_time',start_time,'end_time',end_time,'shift_label',shift_label,'status',status)),'{exchange}','approved') FROM public.shifts WHERE id='{future}'"
    sql(approval, actor=ADMIN, error='relation "shifts" does not exist')
    assert sql(f"SELECT status FROM public.swap_requests WHERE id='{exchange}'") == 'pending'
    sql((root / 'supabase/migrations' / repair).read_text())
    sql((root / 'supabase/migrations' / repair).read_text())
    assert sql("SELECT count(*) FROM pg_catalog.pg_trigger WHERE tgrelid='public.swap_requests'::regclass AND tgfoid='public.handle_swap_approval()'::regprocedure AND NOT tgisinternal") == '0'
    after = json.loads(sql(f"SELECT public.attendance_transition({command},'{uuid.uuid4()}','admin_console')", actor=ADMIN))
    assert after['success'], after
    assert sql(f"SELECT status FROM public.swap_requests WHERE id='{override}'") == 'approved'
    assert sql(f"SELECT check_out IS NULL FROM public.attendance WHERE shift_id='{worked}'") == 't'
    assert sql(f"SELECT employee_id FROM public.shifts WHERE id='{worked}'") == EMP
    sql(approval, actor=ADMIN)
    assert sql(f"SELECT status FROM public.swap_requests WHERE id='{exchange}'") == 'approved'
    assert sql(f"SELECT shift_label FROM public.shifts WHERE id='{future}'") == 'Evening shift'
    print('PASS legacy trigger caused both errors; repair preserves modern override and shift approval')
