-- Requires 005, 006 and 007. Does not enable any branch or change paid hours.
BEGIN;
DO $$ BEGIN IF to_regprocedure('public.attendance_station_token_status(text)') IS NULL THEN RAISE EXCEPTION 'Apply station migration 007 first'; END IF; END $$;
ALTER TABLE public.attendance_policies DROP CONSTRAINT IF EXISTS attendance_policies_smart_qr_enabled_check;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.attendance_policies'::regclass AND conname='smart_qr_requires_engine') THEN
 ALTER TABLE public.attendance_policies ADD CONSTRAINT smart_qr_requires_engine CHECK(NOT smart_qr_enabled OR enforce_engine);
END IF; END $$;
COMMENT ON COLUMN public.attendance_policies.smart_qr_enabled IS 'Opt-in after Smart Scan deployment and staging verification; defaults false.';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_method text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_entry_point text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_verification_status text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_location_accuracy double precision;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_location_captured_at timestamptz;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS check_out_distance_meters double precision;
CREATE TABLE IF NOT EXISTS hrm_private.attendance_qr_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_id uuid NOT NULL, station_id uuid NOT NULL, device_id uuid NOT NULL, store_id uuid NOT NULL,
 employee_id uuid NOT NULL, phase text NOT NULL CHECK(phase IN ('processing','confirmation_required','completed')),
 attendance_id uuid, attendance_version bigint, confirmation_expires_at timestamptz,
 scan_response jsonb, final_response jsonb,
 context_operation_id uuid, context_transaction_id bigint, context_location jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by uuid NOT NULL,
 UNIQUE(employee_id,token_id)
);
CREATE TABLE IF NOT EXISTS hrm_private.attendance_qr_operations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_id uuid NOT NULL, command_hash text NOT NULL, response jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by uuid NOT NULL,
 UNIQUE(created_by,operation_id)
);
ALTER TABLE hrm_private.attendance_qr_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrm_private.attendance_qr_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON hrm_private.attendance_qr_attempts,hrm_private.attendance_qr_operations FROM PUBLIC,anon,authenticated;
CREATE INDEX IF NOT EXISTS attendance_qr_context ON hrm_private.attendance_qr_attempts(context_transaction_id,context_operation_id) WHERE context_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION hrm_private.attendance_transition(p_command jsonb,p_operation_id uuid,p_entry_point text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE
 actor uuid:=auth.uid(); actor_profile public.profiles; subject public.profiles; branch public.stores;
 policy public.attendance_policies; chosen public.shifts; record public.attendance;
 operation public.attendance_operations; request public.swap_requests;
 action text:=p_command->>'action'; employee uuid; requested_shift uuid;
 now_at timestamptz:=clock_timestamp(); today date; count_rows integer; fingerprint text;
 captured timestamptz; accuracy double precision; latitude double precision; longitude double precision;
 distance double precision; radius double precision; result_payload jsonb; expected bigint;
 changes jsonb; day date;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'ATTENDANCE_UNAUTHORIZED: sign in to continue' USING ERRCODE='42501'; END IF;
 IF pg_column_size(p_command)>8192 THEN RAISE EXCEPTION 'ATTENDANCE_INVALID_REQUEST: attendance command is too large' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p_command)<>'object' OR action IS NULL OR action NOT IN ('clock_in','clock_out','admin_create','admin_update','admin_delete','admin_close','approve_reentry','state')
 OR p_entry_point NOT IN ('app_dashboard','server_action','admin_console','smart_scan') OR p_entry_point IS NULL THEN
  RAISE EXCEPTION 'ATTENDANCE_INVALID_REQUEST: invalid attendance command' USING ERRCODE='22023';
 END IF;
 -- Same order as 005; no lock is held during GPS acquisition or push delivery.
 PERFORM pg_catalog.pg_advisory_xact_lock(748913,1);
 now_at:=clock_timestamp(); today:=(now_at AT TIME ZONE 'Asia/Kolkata')::date;
 SELECT * INTO actor_profile FROM public.profiles WHERE id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_UNAUTHORIZED: employee profile unavailable' USING ERRCODE='42501'; END IF;
 IF p_entry_point='smart_scan' AND (action NOT IN ('clock_in','clock_out') OR NOT EXISTS(
  SELECT 1 FROM hrm_private.attendance_qr_attempts q WHERE q.created_by=actor AND q.context_transaction_id=txid_current() AND q.context_operation_id=p_operation_id AND q.phase='processing'
 )) THEN RAISE EXCEPTION 'ATTENDANCE_FORBIDDEN: verified QR context required' USING ERRCODE='42501'; END IF;
 IF action LIKE 'admin_%' OR action='approve_reentry' THEN
  IF actor_profile.role IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'ATTENDANCE_FORBIDDEN: administrator access required' USING ERRCODE='42501'; END IF;
 END IF;
 employee:=coalesce(nullif(p_command->>'employeeId','')::uuid,actor);
 IF action IN ('clock_in','clock_out','state') AND employee<>actor THEN
  RAISE EXCEPTION 'ATTENDANCE_FORBIDDEN: attendance belongs to another employee' USING ERRCODE='42501';
 END IF;
 IF action<>'state' THEN
 IF p_operation_id IS NULL THEN RAISE EXCEPTION 'ATTENDANCE_INVALID_REQUEST: operation UUID required' USING ERRCODE='22023'; END IF;
 fingerprint:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
 SELECT * INTO operation FROM public.attendance_operations WHERE created_by=actor AND operation_id=p_operation_id FOR UPDATE;
 IF FOUND THEN
  IF operation.command_hash<>fingerprint THEN RAISE EXCEPTION 'ATTENDANCE_IDEMPOTENCY_CONFLICT: operation ID was used for a different request' USING ERRCODE='23514'; END IF;
  IF operation.response IS NULL THEN RAISE EXCEPTION 'ATTENDANCE_CONFLICT: operation is still pending' USING ERRCODE='23514'; END IF;
  RETURN operation.response || jsonb_build_object('replayed',true,'changed',false);
 END IF;
 END IF;
 IF action='approve_reentry' THEN
  SELECT * INTO request FROM public.swap_requests WHERE id=(p_command->>'requestId')::uuid FOR UPDATE;
  IF NOT FOUND OR coalesce(request.message,'') NOT LIKE 'OVERRIDE REQUEST%' OR request.status IS DISTINCT FROM 'pending' THEN
   RAISE EXCEPTION 'ATTENDANCE_REQUEST_STALE: re-entry request is no longer pending' USING ERRCODE='23514';
  END IF;
  employee:=request.requestor_id;
 ELSIF action IN ('admin_update','admin_delete','admin_close') THEN
  SELECT * INTO record FROM public.attendance WHERE id=(p_command->>'attendanceId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_NOT_FOUND: attendance record not found' USING ERRCODE='22023'; END IF;
  employee:=record.employee_id;
 END IF;
 SELECT * INTO subject FROM public.profiles WHERE id=employee;
 IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_NOT_FOUND: employee profile not found' USING ERRCODE='22023'; END IF;
 SELECT * INTO branch FROM public.stores WHERE id=subject.store_id;
 SELECT * INTO policy FROM public.attendance_policies WHERE store_id=subject.store_id;
 IF action='state' THEN
  SELECT count(*) INTO count_rows FROM public.attendance WHERE employee_id=employee AND check_out IS NULL;
  SELECT * INTO record FROM public.attendance WHERE employee_id=employee ORDER BY (check_out IS NULL) DESC, check_in DESC LIMIT 1;
  RETURN jsonb_build_object('success',true,'state',CASE WHEN count_rows>1 THEN 'attendance_exception' WHEN count_rows=1 THEN 'clocked_in'
   WHEN record.check_out IS NOT NULL AND (record.check_in::timestamptz AT TIME ZONE 'Asia/Kolkata')::date=today THEN 'completed' ELSE 'not_started' END,
   'data',CASE WHEN record.id IS NOT NULL THEN to_jsonb(record) END,
   'policy',jsonb_build_object('radiusMeters',coalesce(nullif(branch.radius_meters,0),100),'maxAccuracyMeters',coalesce(policy.max_accuracy_meters,nullif(branch.radius_meters,0),100),'maxLocationAgeSeconds',coalesce(policy.max_location_age_seconds,30),'requireLocationMetadata',coalesce(policy.require_location_metadata,false),'smartQrEnabled',coalesce(policy.smart_qr_enabled,false)));
 END IF;
 IF action IN ('clock_in','clock_out','admin_create','approve_reentry') THEN
  SELECT count(*) INTO count_rows FROM public.attendance WHERE employee_id=employee AND check_out IS NULL;
  IF count_rows>1 THEN RAISE EXCEPTION 'ATTENDANCE_CONFLICT: multiple open sessions need administrator review' USING ERRCODE='23514'; END IF;
 END IF;
 IF action='clock_in' THEN
  IF branch.id IS NULL OR (p_command->>'storeId')::uuid IS DISTINCT FROM subject.store_id THEN
   RAISE EXCEPTION 'ATTENDANCE_WRONG_BRANCH: use your assigned store' USING ERRCODE='42501'; END IF;
  IF count_rows=1 THEN
   SELECT * INTO record FROM public.attendance WHERE employee_id=employee AND check_out IS NULL;
   result_payload:=jsonb_build_object('success',true,'changed',false,'state','clocked_in','data',to_jsonb(record),'message','Already clocked in');
   INSERT INTO public.attendance_operations(employee_id,operation_id,command_hash,action,entry_point,transaction_id,response,created_by) VALUES(employee,p_operation_id,fingerprint,action,p_entry_point,txid_current(),result_payload,actor);
   RETURN result_payload;
  END IF;
  requested_shift:=nullif(p_command->>'shiftId','')::uuid;
  SELECT count(*) INTO count_rows FROM public.shifts s WHERE s.employee_id=employee AND
   (requested_shift IS NULL OR s.id=requested_shift) AND (
    (s.start_time::timestamptz AT TIME ZONE 'UTC')::date=today OR
    (now_at>=hrm_private.attendance_shift_start(s) AND now_at<hrm_private.attendance_shift_end(s)));
  IF count_rows<>1 THEN RAISE EXCEPTION 'ATTENDANCE_SHIFT_UNAVAILABLE: no unambiguous assigned shift for this attendance' USING ERRCODE='23514'; END IF;
  SELECT * INTO chosen FROM public.shifts s WHERE s.employee_id=employee AND (requested_shift IS NULL OR s.id=requested_shift) AND
   ((s.start_time::timestamptz AT TIME ZONE 'UTC')::date=today OR (now_at>=hrm_private.attendance_shift_start(s) AND now_at<hrm_private.attendance_shift_end(s))) FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.leave_requests WHERE employee_id=employee AND status='approved' AND start_date<=(chosen.start_time::timestamptz AT TIME ZONE 'UTC')::date AND end_date>=(chosen.start_time::timestamptz AT TIME ZONE 'UTC')::date) THEN
   RAISE EXCEPTION 'ATTENDANCE_ON_LEAVE: approved leave covers this date' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM public.attendance a WHERE a.employee_id=employee AND
   (a.shift_id=chosen.id OR (a.shift_id IS NULL AND (a.check_in::timestamptz AT TIME ZONE 'Asia/Kolkata')::date=(chosen.start_time::timestamptz AT TIME ZONE 'UTC')::date))) THEN
   RAISE EXCEPTION 'ATTENDANCE_COMPLETED: this shift already has attendance; request authorized re-entry' USING ERRCODE='23514'; END IF;
  latitude:=(p_command->>'lat')::double precision; longitude:=(p_command->>'lng')::double precision;
  IF latitude IS NULL OR longitude IS NULL OR NOT(latitude BETWEEN -90 AND 90) OR NOT(longitude BETWEEN -180 AND 180)
   OR branch.lat IS NULL OR branch.lng IS NULL OR NOT(branch.lat BETWEEN -90 AND 90) OR NOT(branch.lng BETWEEN -180 AND 180) THEN
   RAISE EXCEPTION 'ATTENDANCE_LOCATION_UNAVAILABLE: valid employee and store coordinates required' USING ERRCODE='22023'; END IF;
  radius:=coalesce(nullif(branch.radius_meters,0),100);
  IF radius<=0 THEN RAISE EXCEPTION 'ATTENDANCE_LOCATION_UNAVAILABLE: store radius is not configured' USING ERRCODE='22023'; END IF;
  accuracy:=nullif(p_command->>'accuracy','')::double precision;
  captured:=nullif(p_command->>'capturedAt','')::timestamptz;
  IF (accuracy IS NULL)<>(captured IS NULL) OR (coalesce(policy.require_location_metadata,false) AND accuracy IS NULL) THEN
   RAISE EXCEPTION 'ATTENDANCE_LOCATION_METADATA_REQUIRED: update the app and obtain a fresh location' USING ERRCODE='22023'; END IF;
  IF accuracy IS NOT NULL AND (NOT(accuracy BETWEEN 0 AND coalesce(policy.max_accuracy_meters,radius)) OR captured<now_at-make_interval(secs=>coalesce(policy.max_location_age_seconds,30)) OR captured>now_at+interval '5 seconds') THEN
   RAISE EXCEPTION 'ATTENDANCE_LOCATION_RETRY: location is stale or imprecise; move near the entrance and retry, or ask your manager for a correction' USING ERRCODE='22023'; END IF;
  distance:=6371000*2*asin(sqrt(least(1.0,greatest(0.0,power(sin(radians(branch.lat-latitude)/2),2)+cos(radians(latitude))*cos(radians(branch.lat))*power(sin(radians(branch.lng-longitude)/2),2)))));
  IF distance>radius THEN RAISE EXCEPTION 'ATTENDANCE_OUTSIDE_STORE: move within your store attendance area and retry' USING ERRCODE='22023'; END IF;
 ELSIF action='clock_out' THEN
  IF coalesce(policy.require_session_binding,false) AND (nullif(p_command->>'attendanceId','') IS NULL OR nullif(p_command->>'expectedVersion','') IS NULL) THEN
   RAISE EXCEPTION 'ATTENDANCE_STALE: update the app and refresh attendance before clocking out' USING ERRCODE='23514'; END IF;
  IF nullif(p_command->>'attendanceId','') IS NOT NULL THEN
   SELECT * INTO record FROM public.attendance WHERE id=(p_command->>'attendanceId')::uuid AND employee_id=employee FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_NOT_FOUND: attendance session not found' USING ERRCODE='22023'; END IF;
  ELSE
   SELECT * INTO record FROM public.attendance WHERE employee_id=employee AND check_out IS NULL FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_NOT_FOUND: no active shift to clock out' USING ERRCODE='22023'; END IF;
  END IF;
 END IF;
 IF action='approve_reentry' THEN
  SELECT count(*) INTO count_rows FROM public.attendance WHERE employee_id=employee AND check_out IS NULL;
  IF count_rows>0 THEN RAISE EXCEPTION 'ATTENDANCE_CONFLICT: employee already has an open session' USING ERRCODE='23514'; END IF;
  SELECT * INTO chosen FROM public.shifts WHERE id=request.shift_id AND employee_id=employee;
  IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_SHIFT_UNAVAILABLE: re-entry must identify an assigned shift' USING ERRCODE='23514'; END IF;
  day:=(chosen.start_time::timestamptz AT TIME ZONE 'UTC')::date;
  IF day<>today AND NOT(now_at>=hrm_private.attendance_shift_start(chosen) AND now_at<hrm_private.attendance_shift_end(chosen)) THEN
   RAISE EXCEPTION 'ATTENDANCE_REQUEST_STALE: historical attendance needs a correction, not re-entry' USING ERRCODE='23514'; END IF;
  SELECT count(*) INTO count_rows FROM public.attendance WHERE employee_id=employee AND shift_id=chosen.id AND check_out IS NOT NULL;
  IF count_rows<>1 THEN RAISE EXCEPTION 'ATTENDANCE_CONFLICT: re-entry must resolve to exactly one completed record' USING ERRCODE='23514'; END IF;
  SELECT * INTO record FROM public.attendance WHERE employee_id=employee AND shift_id=chosen.id AND check_out IS NOT NULL FOR UPDATE;
 END IF;
 expected:=nullif(p_command->>'expectedVersion','')::bigint;
 IF record.id IS NOT NULL AND expected IS NOT NULL AND record.version<>expected THEN
  RAISE EXCEPTION 'ATTENDANCE_STALE: attendance changed; refresh before trying again' USING ERRCODE='23514'; END IF;
 IF action IN ('admin_create','admin_update') THEN
  changes:=CASE WHEN action='admin_create' THEN p_command ELSE p_command->'updates' END;
  IF changes IS NULL OR jsonb_typeof(changes)<>'object' THEN RAISE EXCEPTION 'ATTENDANCE_INVALID_REQUEST: attendance changes required' USING ERRCODE='22023'; END IF;
  IF action='admin_create' THEN
   record.employee_id:=employee; record.store_id:=subject.store_id;
   record.check_in:=(changes->>'check_in')::timestamptz; record.check_out:=nullif(changes->>'check_out','')::timestamptz;
  ELSE
   IF changes?'check_in' THEN record.check_in:=(changes->>'check_in')::timestamptz; END IF;
   IF changes?'check_out' THEN record.check_out:=nullif(changes->>'check_out','')::timestamptz; END IF;
  END IF;
  IF record.check_in IS NULL OR (record.check_out IS NOT NULL AND record.check_out<=record.check_in) THEN
   RAISE EXCEPTION 'ATTENDANCE_INVALID_TIMES: check-in must precede check-out' USING ERRCODE='22023'; END IF;
  IF changes?'shift_id' THEN
   requested_shift:=nullif(changes->>'shift_id','')::uuid;
   SELECT * INTO chosen FROM public.shifts WHERE id=requested_shift AND employee_id=employee;
   IF NOT FOUND THEN
    -- Compatibility: the existing admin form submits a preset ID. Resolve it
    -- only to a real assigned shift, never save a preset as an attendance FK.
    SELECT count(*) INTO count_rows FROM public.shifts s JOIN public.shift_presets p ON p.id=requested_shift AND p.label=s.shift_label
     WHERE s.employee_id=employee AND (s.start_time::timestamptz AT TIME ZONE 'UTC')::date=(record.check_in::timestamptz AT TIME ZONE 'UTC')::date;
    IF count_rows<>1 THEN RAISE EXCEPTION 'ATTENDANCE_SHIFT_UNAVAILABLE: select an assigned shift for this date' USING ERRCODE='23514'; END IF;
    SELECT s.* INTO chosen FROM public.shifts s JOIN public.shift_presets p ON p.id=requested_shift AND p.label=s.shift_label
     WHERE s.employee_id=employee AND (s.start_time::timestamptz AT TIME ZONE 'UTC')::date=(record.check_in::timestamptz AT TIME ZONE 'UTC')::date;
   END IF;
   record.shift_id:=chosen.id;
  END IF;
  IF action='admin_create' AND EXISTS(SELECT 1 FROM public.attendance WHERE employee_id=employee AND (shift_id=record.shift_id OR (check_in::timestamptz AT TIME ZONE 'UTC')::date=(record.check_in::timestamptz AT TIME ZONE 'UTC')::date)) THEN
   RAISE EXCEPTION 'ATTENDANCE_CONFLICT: attendance already exists; use the existing edit workflow' USING ERRCODE='23514'; END IF;
 END IF;
 INSERT INTO public.attendance_operations(employee_id,operation_id,command_hash,action,entry_point,reason,transaction_id,created_by)
 VALUES(employee,p_operation_id,fingerprint,action,p_entry_point,left(p_command->>'reason',1000),txid_current(),actor) RETURNING * INTO operation;
 IF action='clock_in' THEN
  INSERT INTO public.attendance(employee_id,store_id,shift_id,check_in,check_in_lat,check_in_lng,is_within_geofence,is_auto_checkout,attendance_method,entry_point,verification_status,location_accuracy,location_captured_at,distance_meters)
  VALUES(employee,branch.id,chosen.id,now_at,latitude,longitude,true,false,CASE WHEN p_entry_point='smart_scan' THEN 'smart_qr' ELSE 'manual' END,p_entry_point,CASE WHEN p_entry_point='smart_scan' THEN 'verified_qr' ELSE CASE WHEN accuracy IS NULL THEN 'legacy_metadata' ELSE 'verified' END END,accuracy,captured,distance) RETURNING * INTO record;
 ELSIF action IN ('clock_out','admin_close') THEN
  IF record.check_out IS NULL THEN UPDATE public.attendance SET check_out=now_at,
   check_out_method=CASE WHEN action='admin_close' THEN 'admin_correction' WHEN p_entry_point='smart_scan' THEN 'smart_qr' ELSE 'manual' END,
   check_out_entry_point=p_entry_point,
   check_out_verification_status=CASE WHEN action='admin_close' THEN 'admin_recorded' WHEN p_entry_point='smart_scan' THEN 'verified_qr' ELSE 'not_required' END,
   check_out_location_accuracy=CASE WHEN p_entry_point='smart_scan' THEN (SELECT (context_location->>'accuracy')::double precision FROM hrm_private.attendance_qr_attempts WHERE context_transaction_id=txid_current() AND context_operation_id=p_operation_id AND created_by=actor) END,
   check_out_location_captured_at=CASE WHEN p_entry_point='smart_scan' THEN (SELECT (context_location->>'capturedAt')::timestamptz FROM hrm_private.attendance_qr_attempts WHERE context_transaction_id=txid_current() AND context_operation_id=p_operation_id AND created_by=actor) END,
   check_out_distance_meters=CASE WHEN p_entry_point='smart_scan' THEN (SELECT (context_location->>'distance')::double precision FROM hrm_private.attendance_qr_attempts WHERE context_transaction_id=txid_current() AND context_operation_id=p_operation_id AND created_by=actor) END
   WHERE id=record.id RETURNING * INTO record;
  ELSE result_payload:=jsonb_build_object('changed',false); END IF;
 ELSIF action='approve_reentry' THEN
  UPDATE public.attendance SET check_out=NULL,is_auto_checkout=false WHERE id=record.id RETURNING * INTO record;
  UPDATE public.swap_requests SET status='approved' WHERE id=request.id;
 ELSIF action='admin_create' THEN
  INSERT INTO public.attendance(employee_id,store_id,shift_id,check_in,check_out,is_within_geofence,is_auto_checkout,attendance_method,entry_point,verification_status)
  VALUES(employee,subject.store_id,record.shift_id,record.check_in,record.check_out,false,false,'admin_correction',p_entry_point,'admin_recorded') RETURNING * INTO record;
 ELSIF action='admin_update' THEN
  UPDATE public.attendance SET check_in=record.check_in,check_out=record.check_out,shift_id=record.shift_id WHERE id=record.id RETURNING * INTO record;
 ELSIF action='admin_delete' THEN
  DELETE FROM public.attendance WHERE id=record.id;
 END IF;
 result_payload:=jsonb_build_object('success',true,'changed',coalesce((result_payload->>'changed')::boolean,true),'state',CASE WHEN action='admin_delete' THEN 'not_started' WHEN record.check_out IS NULL THEN 'clocked_in' ELSE 'completed' END,'data',to_jsonb(record),'count',1);
 UPDATE public.attendance_operations SET response=result_payload,updated_at=clock_timestamp() WHERE id=operation.id;
 RETURN result_payload;
EXCEPTION WHEN OTHERS THEN
 -- Return a rejected outcome after rolling back the operation subtransaction,
 -- allowing the rejection audit to commit without any partial attendance write.
 SELECT * INTO actor_profile FROM public.profiles WHERE id=actor;
 IF actor_profile.id IS NOT NULL THEN
  INSERT INTO public.attendance_audit_events(employee_id,store_id,event_type,attendance_method,entry_point,reason,new_values,created_by)
  VALUES(actor,actor_profile.store_id,'rejected_attempt','manual',CASE WHEN p_entry_point IN ('app_dashboard','server_action','admin_console','smart_scan') THEN p_entry_point END,
   CASE WHEN SQLERRM LIKE 'ATTENDANCE_%' OR SQLERRM LIKE 'SHIFT_%' THEN SQLERRM ELSE 'Attendance request could not be processed' END,
   jsonb_build_object('sqlstate',SQLSTATE),actor);
 END IF;
 RETURN jsonb_build_object('success',false,'error',CASE WHEN SQLERRM LIKE 'ATTENDANCE_%' OR SQLERRM LIKE 'SHIFT_%' THEN SQLERRM ELSE 'ATTENDANCE_INVALID_REQUEST: attendance request could not be processed' END,'code',SQLSTATE);
END $$;
CREATE OR REPLACE FUNCTION hrm_private.attendance_audit_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE saved public.attendance; op public.attendance_operations;
BEGIN
 IF TG_OP='DELETE' THEN saved:=OLD; ELSE saved:=NEW; END IF;
 SELECT * INTO op FROM public.attendance_operations WHERE transaction_id=txid_current() AND response IS NULL
  AND created_by=auth.uid() AND employee_id=saved.employee_id LIMIT 1;
 INSERT INTO public.attendance_audit_events(employee_id,store_id,attendance_id,shift_id,operation_id,event_type,attendance_method,entry_point,reason,previous_values,new_values,created_by)
 VALUES(saved.employee_id,saved.store_id,saved.id,saved.shift_id,op.operation_id,
 CASE WHEN op.action IS NOT NULL THEN op.action ELSE 'legacy_'||lower(TG_OP) END,
 CASE WHEN op.action LIKE 'admin_%' OR op.action='approve_reentry' THEN 'admin_correction' WHEN op.entry_point='smart_scan' THEN 'smart_qr' WHEN op.id IS NOT NULL THEN 'manual' ELSE 'legacy' END,
 op.entry_point,op.reason,
 CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD)-'check_in_lat'-'check_in_lng' END,
 CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW)-'check_in_lat'-'check_in_lng' END,auth.uid());
 RETURN NULL;
END $$;

-- QR always requires fresh, precise location, including clock-out. Manual policy is unchanged.
CREATE OR REPLACE FUNCTION hrm_private.smart_location(p_store uuid,p_location jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE branch public.stores; policy public.attendance_policies; latitude double precision; longitude double precision; accuracy double precision; captured timestamptz; distance double precision; radius double precision; stamp timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO branch FROM public.stores WHERE id=p_store;
 SELECT * INTO policy FROM public.attendance_policies WHERE store_id=p_store;
 latitude:=(p_location->>'lat')::double precision; longitude:=(p_location->>'lng')::double precision;
 accuracy:=(p_location->>'accuracy')::double precision; captured:=(p_location->>'capturedAt')::timestamptz;
 radius:=coalesce(nullif(branch.radius_meters,0),100);
 IF latitude IS NULL OR longitude IS NULL OR accuracy IS NULL OR captured IS NULL OR NOT isfinite(captured)
 OR NOT(latitude BETWEEN -90 AND 90) OR NOT(longitude BETWEEN -180 AND 180) OR NOT(accuracy BETWEEN 0 AND least(coalesce(policy.max_accuracy_meters,radius),radius))
 OR captured<stamp-make_interval(secs=>coalesce(policy.max_location_age_seconds,30)) OR captured>stamp+interval '5 seconds' THEN
  RAISE EXCEPTION 'ATTENDANCE_LOCATION_RETRY: obtain a fresh precise location, or ask your manager for a correction' USING ERRCODE='22023'; END IF;
 IF branch.id IS NULL OR branch.lat IS NULL OR branch.lng IS NULL OR NOT(branch.lat BETWEEN -90 AND 90) OR NOT(branch.lng BETWEEN -180 AND 180) OR radius<=0 THEN
  RAISE EXCEPTION 'ATTENDANCE_LOCATION_UNAVAILABLE: ask your manager to check the branch location' USING ERRCODE='22023'; END IF;
 distance:=6371000*2*asin(sqrt(least(1.0,greatest(0.0,power(sin(radians(branch.lat-latitude)/2),2)+cos(radians(latitude))*cos(radians(branch.lat))*power(sin(radians(branch.lng-longitude)/2),2)))));
 IF distance>radius THEN RAISE EXCEPTION 'ATTENDANCE_OUTSIDE_STORE: move within your branch attendance area and retry' USING ERRCODE='22023'; END IF;
 IF distance+accuracy>radius THEN RAISE EXCEPTION 'ATTENDANCE_LOCATION_RETRY: location overlaps the attendance boundary; move closer or request a manager correction' USING ERRCODE='22023'; END IF;
 RETURN p_location||jsonb_build_object('distance',distance);
END $$;

CREATE OR REPLACE FUNCTION hrm_private.attendance_smart_scan(p_command jsonb,p_operation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE actor uuid:=auth.uid(); employee public.profiles; branch public.stores; policy public.attendance_policies;
 action text:=p_command->>'action'; fingerprint text; receipt hrm_private.attendance_qr_operations;
 attempt hrm_private.attendance_qr_attempts; token hrm_private.attendance_station_tokens;
 station public.attendance_stations; device public.attendance_station_devices; session public.attendance; assigned public.shifts;
 stamp timestamptz; verified jsonb; location jsonb; result jsonb; count_rows integer; command jsonb;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'ATTENDANCE_UNAUTHORIZED: sign in to continue' USING ERRCODE='42501'; END IF;
 IF p_command IS NULL OR jsonb_typeof(p_command)<>'object' OR pg_column_size(p_command)>8192 OR action IS NULL OR action NOT IN ('config','scan','confirm') THEN
  RAISE EXCEPTION 'ATTENDANCE_INVALID_REQUEST: invalid scan request' USING ERRCODE='22023'; END IF;
 -- Match the attendance/scheduling lock before station/device locks.
 PERFORM pg_catalog.pg_advisory_xact_lock(748913,1);
 SELECT * INTO employee FROM public.profiles WHERE id=actor;
 IF employee.role IS NULL OR employee.role NOT IN ('employee','manager') THEN RAISE EXCEPTION 'ATTENDANCE_FORBIDDEN: employee access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO branch FROM public.stores WHERE id=employee.store_id;
 SELECT * INTO policy FROM public.attendance_policies WHERE store_id=employee.store_id;
 IF action='config' THEN
  result:=hrm_private.attendance_transition('{"action":"state"}',gen_random_uuid(),'app_dashboard');
  RETURN jsonb_build_object('success',true,'state','ready','enabled',coalesce(policy.smart_qr_enabled,false),'branchName',branch.name,'serverNow',clock_timestamp(),
   'store',CASE WHEN branch.id IS NOT NULL THEN jsonb_build_object('lat',branch.lat,'lng',branch.lng,'radius_meters',branch.radius_meters) END,
   'policy',result->'policy','attendance',result);
 END IF;
 IF p_operation_id IS NULL THEN RAISE EXCEPTION 'ATTENDANCE_INVALID_REQUEST: operation UUID required' USING ERRCODE='22023'; END IF;
 fingerprint:=encode(sha256(convert_to(p_command::text,'UTF8')),'hex');
 SELECT * INTO receipt FROM hrm_private.attendance_qr_operations WHERE created_by=actor AND operation_id=p_operation_id;
 IF FOUND THEN
  IF receipt.command_hash<>fingerprint THEN RAISE EXCEPTION 'ATTENDANCE_IDEMPOTENCY_CONFLICT: retry the original request unchanged' USING ERRCODE='23514'; END IF;
  RETURN receipt.response||jsonb_build_object('replayed',true,'changed',false)||CASE WHEN receipt.response->>'state'='confirmation_required' THEN jsonb_build_object('serverNow',clock_timestamp()) ELSE '{}'::jsonb END;
 END IF;
 IF NOT coalesce(policy.smart_qr_enabled,false) THEN RAISE EXCEPTION 'ATTENDANCE_SCAN_DISABLED: Smart Scan is not enabled for your branch; use manual attendance' USING ERRCODE='23514'; END IF;
 IF action='scan' THEN
  verified:=hrm_private.station_token_status(p_command->>'token');
  IF NOT coalesce((verified->>'success')::boolean,false) THEN RAISE EXCEPTION '%',verified->>'error' USING ERRCODE=coalesce(verified->>'code','22023'); END IF;
  SELECT * INTO token FROM hrm_private.attendance_station_tokens WHERE id=(verified->'data'->>'tokenId')::uuid;
  SELECT * INTO station FROM public.attendance_stations WHERE id=token.station_id FOR UPDATE;
  SELECT * INTO device FROM public.attendance_station_devices WHERE id=token.device_id FOR UPDATE;
  verified:=hrm_private.station_token_status(p_command->>'token');
  IF NOT coalesce((verified->>'success')::boolean,false) THEN RAISE EXCEPTION '%',verified->>'error' USING ERRCODE=coalesce(verified->>'code','22023'); END IF;
  SELECT * INTO attempt FROM hrm_private.attendance_qr_attempts WHERE employee_id=actor AND token_id=token.id;
  IF FOUND THEN
   result:=coalesce(attempt.final_response,attempt.scan_response)||jsonb_build_object('replayed',true,'changed',false);
  ELSE
   location:=hrm_private.smart_location(branch.id,p_command->'location');
   SELECT count(*) INTO count_rows FROM public.attendance WHERE employee_id=actor AND check_out IS NULL;
   IF count_rows>1 THEN RAISE EXCEPTION 'ATTENDANCE_CONFLICT: multiple open sessions need administrator review' USING ERRCODE='23514'; END IF;
   stamp:=clock_timestamp();
   INSERT INTO hrm_private.attendance_qr_attempts(token_id,station_id,device_id,store_id,employee_id,phase,context_operation_id,context_transaction_id,context_location,created_by)
    VALUES(token.id,station.id,device.id,branch.id,actor,'processing',p_operation_id,txid_current(),location,actor) RETURNING * INTO attempt;
   IF count_rows=0 THEN
    command:=jsonb_build_object('action','clock_in','employeeId',actor,'storeId',branch.id)||location;
    result:=hrm_private.attendance_transition(command,p_operation_id,'smart_scan');
    IF NOT coalesce((result->>'success')::boolean,false) THEN RAISE EXCEPTION '%',result->>'error' USING ERRCODE=coalesce(result->>'code','22023'); END IF;
    result:=result||jsonb_build_object('branchName',branch.name);
    UPDATE hrm_private.attendance_qr_attempts SET phase='completed',attendance_id=(result->'data'->>'id')::uuid,scan_response=result,final_response=result,context_operation_id=NULL,context_transaction_id=NULL,context_location=NULL,updated_at=clock_timestamp() WHERE id=attempt.id;
   ELSE
    SELECT * INTO session FROM public.attendance WHERE employee_id=actor AND check_out IS NULL FOR UPDATE;
    IF session.store_id IS DISTINCT FROM branch.id THEN RAISE EXCEPTION 'ATTENDANCE_WRONG_BRANCH: the active session belongs to another branch; ask your manager' USING ERRCODE='42501'; END IF;
    SELECT * INTO assigned FROM public.shifts WHERE id=session.shift_id;
    result:=jsonb_build_object('success',true,'state','confirmation_required','changed',false,'data',to_jsonb(session),'confirmationId',attempt.id,'expiresAt',stamp+interval '120 seconds','serverNow',stamp,'branchName',branch.name,
     'scheduledEnd',CASE WHEN assigned.id IS NOT NULL THEN hrm_private.attendance_shift_end(assigned) END);
    UPDATE hrm_private.attendance_qr_attempts SET phase='confirmation_required',attendance_id=session.id,attendance_version=session.version,confirmation_expires_at=stamp+interval '120 seconds',scan_response=result,context_operation_id=NULL,context_transaction_id=NULL,context_location=NULL,updated_at=stamp WHERE id=attempt.id;
   END IF;
  END IF;
 ELSE
  SELECT * INTO attempt FROM hrm_private.attendance_qr_attempts WHERE id=(p_command->>'confirmationId')::uuid AND created_by=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_CONFIRMATION_INVALID: scan a fresh station code' USING ERRCODE='42501'; END IF;
  SELECT * INTO station FROM public.attendance_stations WHERE id=attempt.station_id FOR UPDATE;
  SELECT * INTO device FROM public.attendance_station_devices WHERE id=attempt.device_id FOR UPDATE;
  stamp:=clock_timestamp();
  IF attempt.phase<>'confirmation_required' OR attempt.confirmation_expires_at<=stamp THEN RAISE EXCEPTION 'ATTENDANCE_CONFIRMATION_EXPIRED: scan a fresh code to clock out' USING ERRCODE='23514'; END IF;
  IF NOT station.active OR station.store_id IS DISTINCT FROM attempt.store_id OR branch.id IS DISTINCT FROM attempt.store_id OR device.approved_at IS NULL OR device.revoked_at IS NOT NULL OR device.credential_expires_at<=stamp THEN
   RAISE EXCEPTION 'ATTENDANCE_STATION_REVOKED: this station is no longer authorized; scan another code or use manual attendance' USING ERRCODE='42501'; END IF;
  SELECT * INTO session FROM public.attendance WHERE id=attempt.attendance_id AND employee_id=actor FOR UPDATE;
  IF NOT FOUND OR session.check_out IS NOT NULL OR session.version<>attempt.attendance_version OR session.store_id IS DISTINCT FROM branch.id THEN RAISE EXCEPTION 'ATTENDANCE_STALE: the session changed; refresh attendance and scan again' USING ERRCODE='23514'; END IF;
  location:=hrm_private.smart_location(branch.id,p_command->'location');
  UPDATE hrm_private.attendance_qr_attempts SET phase='processing',context_operation_id=p_operation_id,context_transaction_id=txid_current(),context_location=location WHERE id=attempt.id;
  result:=hrm_private.attendance_transition(jsonb_build_object('action','clock_out','employeeId',actor,'attendanceId',session.id,'expectedVersion',attempt.attendance_version),p_operation_id,'smart_scan');
  IF NOT coalesce((result->>'success')::boolean,false) THEN RAISE EXCEPTION '%',result->>'error' USING ERRCODE=coalesce(result->>'code','22023'); END IF;
  result:=result||jsonb_build_object('branchName',branch.name);
  UPDATE hrm_private.attendance_qr_attempts SET phase='completed',final_response=result,context_operation_id=NULL,context_transaction_id=NULL,context_location=NULL,updated_at=clock_timestamp() WHERE id=attempt.id;
 END IF;
 IF result->>'state'='confirmation_required' THEN result:=result||jsonb_build_object('serverNow',clock_timestamp()); END IF;
 INSERT INTO hrm_private.attendance_qr_operations(operation_id,command_hash,response,created_by) VALUES(p_operation_id,fingerprint,result,actor);
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 IF actor IS NOT NULL AND EXISTS(SELECT 1 FROM public.profiles WHERE id=actor) THEN
  INSERT INTO public.attendance_audit_events(employee_id,store_id,event_type,attendance_method,entry_point,reason,new_values,created_by)
   VALUES(actor,(SELECT store_id FROM public.profiles WHERE id=actor),'qr_rejected_attempt','smart_qr','smart_scan',CASE WHEN SQLERRM LIKE 'ATTENDANCE_%' OR SQLERRM LIKE 'STATION_%' THEN SQLERRM ELSE 'Scan could not be verified' END,jsonb_build_object('sqlstate',SQLSTATE),actor);
 END IF;
 RETURN jsonb_build_object('success',false,'code',SQLSTATE,'error',CASE WHEN SQLERRM LIKE 'ATTENDANCE_%' OR SQLERRM LIKE 'STATION_%' THEN SQLERRM ELSE 'ATTENDANCE_INVALID_REQUEST: scan could not be verified' END);
END $$;
CREATE OR REPLACE FUNCTION public.attendance_smart_scan(p_command jsonb,p_operation_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hrm_private.attendance_smart_scan(p_command,p_operation_id); $$;
REVOKE ALL ON FUNCTION hrm_private.smart_location(uuid,jsonb),hrm_private.attendance_smart_scan(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hrm_private.attendance_smart_scan(jsonb,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.attendance_smart_scan(jsonb,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_smart_scan(jsonb,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
