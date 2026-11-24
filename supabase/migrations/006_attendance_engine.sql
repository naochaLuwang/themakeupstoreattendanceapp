-- Requires 005. Additive foundation; existing hours/settlements are not rewritten.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.commit_shift_changes(jsonb,jsonb,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Apply migration 005 before the attendance engine';
  END IF;
END $$;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS attendance_method text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS entry_point text;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'legacy';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS location_accuracy double precision;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS location_captured_at timestamptz;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS distance_meters double precision;

CREATE TABLE IF NOT EXISTS public.attendance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id),
  enforce_engine boolean NOT NULL DEFAULT false,
  require_location_metadata boolean NOT NULL DEFAULT false,
  require_session_binding boolean NOT NULL DEFAULT false,
  max_accuracy_meters double precision CHECK (max_accuracy_meters BETWEEN 1 AND 1000),
  max_location_age_seconds integer NOT NULL DEFAULT 30 CHECK (max_location_age_seconds BETWEEN 5 AND 120),
  smart_qr_enabled boolean NOT NULL DEFAULT false CHECK (NOT smart_qr_enabled),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
COMMENT ON COLUMN public.attendance_policies.smart_qr_enabled IS 'Reserved, false until the station/token/redemption module is installed; a caller cannot label manual attendance as verified QR.';
CREATE TABLE IF NOT EXISTS public.attendance_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.profiles(id),
  operation_id uuid NOT NULL,
  command_hash text NOT NULL,
  action text NOT NULL,
  entry_point text NOT NULL,
  reason text,
  transaction_id bigint NOT NULL,
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  UNIQUE(created_by, operation_id)
);
CREATE TABLE IF NOT EXISTS public.attendance_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid,
  store_id uuid,
  attendance_id uuid,
  shift_id uuid,
  operation_id uuid,
  event_type text NOT NULL,
  attendance_method text NOT NULL,
  entry_point text,
  reason text,
  previous_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS attendance_employee_active_lookup ON public.attendance(employee_id) WHERE check_out IS NULL;
CREATE INDEX IF NOT EXISTS attendance_employee_shift_lookup ON public.attendance(employee_id,shift_id);
CREATE INDEX IF NOT EXISTS attendance_employee_date_lookup ON public.attendance(employee_id,check_in DESC);
CREATE INDEX IF NOT EXISTS attendance_audit_store_date_lookup ON public.attendance_audit_events(store_id,created_at DESC);
CREATE INDEX IF NOT EXISTS attendance_operations_context ON public.attendance_operations(transaction_id) WHERE response IS NULL;

ALTER TABLE public.attendance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audit_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_policies,public.attendance_operations,public.attendance_audit_events FROM anon,authenticated;
GRANT SELECT ON public.attendance_policies,public.attendance_operations,public.attendance_audit_events TO authenticated;
GRANT INSERT,UPDATE ON public.attendance_policies TO authenticated;
DROP POLICY IF EXISTS attendance_policy_read ON public.attendance_policies;
CREATE POLICY attendance_policy_read ON public.attendance_policies FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND (p.role='admin' OR p.store_id=attendance_policies.store_id))
);
DROP POLICY IF EXISTS attendance_policy_admin ON public.attendance_policies;
CREATE POLICY attendance_policy_admin ON public.attendance_policies FOR ALL TO authenticated
USING(EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role='admin'))
WITH CHECK(EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role='admin'));
DROP POLICY IF EXISTS attendance_operation_read ON public.attendance_operations;
CREATE POLICY attendance_operation_read ON public.attendance_operations FOR SELECT TO authenticated USING(created_by=(SELECT auth.uid()));
DROP POLICY IF EXISTS attendance_audit_read ON public.attendance_audit_events;
CREATE POLICY attendance_audit_read ON public.attendance_audit_events FOR SELECT TO authenticated USING(
  employee_id=(SELECT auth.uid()) OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND
  (p.role='admin' OR (p.role='manager' AND p.store_id IS NOT NULL AND p.store_id=attendance_audit_events.store_id)))
);

CREATE OR REPLACE FUNCTION hrm_private.attendance_authority_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE allowed boolean;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(748913,1);
 SELECT (role='admin') INTO allowed FROM public.profiles WHERE id=auth.uid();
 IF coalesce(allowed,false) OR (auth.uid() IS NULL AND current_setting('role',true) IN ('none','service_role')) THEN
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
 END IF;
 IF TG_TABLE_NAME='stores' THEN RAISE EXCEPTION 'Only an administrator can change attendance branch settings' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND ROW(NEW.role,NEW.store_id,NEW.hourly_rate) IS DISTINCT FROM ROW(OLD.role,OLD.store_id,OLD.hourly_rate) THEN
  RAISE EXCEPTION 'Employees cannot change their role, branch or hourly rate' USING ERRCODE='42501';
 ELSIF TG_OP='INSERT' AND (NEW.role<>'employee' OR NEW.store_id IS NOT NULL OR coalesce(NEW.hourly_rate,0)<>0) THEN
  RAISE EXCEPTION 'Only an administrator can assign employment authorization' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hrm_attendance_profile_authority ON public.profiles;
CREATE TRIGGER hrm_attendance_profile_authority BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION hrm_private.attendance_authority_guard();
DROP TRIGGER IF EXISTS hrm_attendance_store_authority ON public.stores;
CREATE TRIGGER hrm_attendance_store_authority BEFORE INSERT OR UPDATE OR DELETE ON public.stores FOR EACH ROW EXECUTE FUNCTION hrm_private.attendance_authority_guard();
REVOKE ALL ON FUNCTION hrm_private.attendance_authority_guard() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION hrm_private.attendance_shift_start(s public.shifts)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT (s.start_time::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata';
$$;
CREATE OR REPLACE FUNCTION hrm_private.attendance_shift_end(s public.shifts)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN s.end_time IS NULL THEN NULL
 WHEN s.end_time::timestamptz <= s.start_time::timestamptz THEN ((s.end_time::timestamptz AT TIME ZONE 'UTC')+interval '1 day') AT TIME ZONE 'Asia/Kolkata'
 ELSE (s.end_time::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata' END;
$$;
-- Extend 005 association validation for a real overnight arrival after midnight.
CREATE OR REPLACE FUNCTION hrm_private.serialize_attendance_shift()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' SET timezone='UTC' AS $$
DECLARE linked public.shifts;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(748913,1);
 IF NEW.shift_id IS NOT NULL THEN
  SELECT * INTO linked FROM public.shifts WHERE id=NEW.shift_id FOR UPDATE;
  IF NOT FOUND OR linked.employee_id IS DISTINCT FROM NEW.employee_id OR NOT (
   (linked.start_time::timestamptz AT TIME ZONE 'UTC')::date=(NEW.check_in::timestamptz AT TIME ZONE 'Asia/Kolkata')::date OR
   (NEW.check_in::timestamptz>=hrm_private.attendance_shift_start(linked) AND NEW.check_in::timestamptz<hrm_private.attendance_shift_end(linked))
  ) THEN RAISE EXCEPTION 'SHIFT_SCHEDULE_STALE: attendance does not match this employee and shift day' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION hrm_private.attendance_write_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE subject uuid; branch uuid; actor_role text; trusted boolean; guarded boolean;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(748913,1);
 subject:=CASE WHEN TG_OP='DELETE' THEN OLD.employee_id ELSE NEW.employee_id END;
 SELECT store_id INTO branch FROM public.profiles WHERE id=subject;
 SELECT role INTO actor_role FROM public.profiles WHERE id=auth.uid();
 SELECT EXISTS(SELECT 1 FROM public.attendance_policies p WHERE p.enforce_engine AND (p.store_id=branch OR p.store_id=(SELECT store_id FROM public.profiles WHERE id=auth.uid()) OR (TG_OP<>'INSERT' AND p.store_id=(SELECT store_id FROM public.profiles WHERE id=OLD.employee_id)))) INTO guarded;
 SELECT EXISTS(SELECT 1 FROM public.attendance_operations WHERE transaction_id=txid_current() AND response IS NULL
  AND created_by=auth.uid() AND employee_id=subject) INTO trusted;
 IF NOT trusted AND coalesce(guarded,false) AND coalesce(actor_role,'')<>'admin'
   AND NOT (auth.uid() IS NULL AND current_setting('role',true) IN ('none','service_role')) THEN
  RAISE EXCEPTION 'ATTENDANCE_ENGINE_REQUIRED: use the authenticated attendance service' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NOT isfinite(NEW.check_in::timestamptz) OR (NEW.check_out IS NOT NULL AND (NOT isfinite(NEW.check_out::timestamptz) OR NEW.check_out::timestamptz<=NEW.check_in::timestamptz)) THEN
  RAISE EXCEPTION 'ATTENDANCE_INVALID_TIMES: checkout must follow check-in' USING ERRCODE='22023';
 END IF;
 IF (TG_OP='INSERT' OR NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.check_out IS NULL) AND NEW.check_out IS NULL
 AND EXISTS(SELECT 1 FROM public.attendance a WHERE a.employee_id=NEW.employee_id AND a.check_out IS NULL AND a.id<>NEW.id) THEN
  RAISE EXCEPTION 'ATTENDANCE_CONFLICT: another attendance session is still open' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' THEN NEW.version:=OLD.version+1; ELSE NEW.version:=1; END IF;
 RETURN NEW;
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
 CASE WHEN op.action LIKE 'admin_%' OR op.action='approve_reentry' THEN 'admin_correction' WHEN op.id IS NOT NULL THEN 'manual' ELSE 'legacy' END,
 op.entry_point,op.reason,
 CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD)-'check_in_lat'-'check_in_lng' END,
 CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW)-'check_in_lat'-'check_in_lng' END,auth.uid());
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION hrm_private.attendance_immutable_audit()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 RAISE EXCEPTION 'Attendance audit and idempotency records cannot be rewritten directly' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS hrm_attendance_guard ON public.attendance;
CREATE TRIGGER hrm_attendance_guard BEFORE INSERT OR UPDATE OR DELETE ON public.attendance FOR EACH ROW EXECUTE FUNCTION hrm_private.attendance_write_guard();
DROP TRIGGER IF EXISTS hrm_attendance_audit ON public.attendance;
CREATE TRIGGER hrm_attendance_audit AFTER INSERT OR UPDATE OR DELETE ON public.attendance FOR EACH ROW EXECUTE FUNCTION hrm_private.attendance_audit_write();
DROP TRIGGER IF EXISTS hrm_attendance_audit_immutable ON public.attendance_audit_events;
CREATE TRIGGER hrm_attendance_audit_immutable BEFORE UPDATE OR DELETE ON public.attendance_audit_events FOR EACH ROW EXECUTE FUNCTION hrm_private.attendance_immutable_audit();

CREATE OR REPLACE FUNCTION hrm_private.attendance_policy_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(748913,1);
 IF TG_OP='UPDATE' THEN NEW.created_at:=OLD.created_at; NEW.created_by:=OLD.created_by;
 ELSE NEW.created_by:=coalesce(auth.uid(),NEW.created_by); END IF;
 NEW.updated_at:=clock_timestamp();
 INSERT INTO public.attendance_audit_events(store_id,event_type,attendance_method,entry_point,previous_values,new_values,created_by)
 VALUES(NEW.store_id,'policy_changed','configuration','admin_console',CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END,to_jsonb(NEW),auth.uid());
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hrm_attendance_policy_audit ON public.attendance_policies;
CREATE TRIGGER hrm_attendance_policy_audit BEFORE INSERT OR UPDATE ON public.attendance_policies FOR EACH ROW EXECUTE FUNCTION hrm_private.attendance_policy_audit();
REVOKE ALL ON FUNCTION hrm_private.attendance_policy_audit() FROM PUBLIC,anon,authenticated;

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
 OR p_entry_point NOT IN ('app_dashboard','server_action','admin_console') OR p_entry_point IS NULL THEN
  RAISE EXCEPTION 'ATTENDANCE_INVALID_REQUEST: invalid attendance command' USING ERRCODE='22023';
 END IF;
 -- Same order as 005; no lock is held during GPS acquisition or push delivery.
 PERFORM pg_catalog.pg_advisory_xact_lock(748913,1);
 now_at:=clock_timestamp(); today:=(now_at AT TIME ZONE 'Asia/Kolkata')::date;
 SELECT * INTO actor_profile FROM public.profiles WHERE id=actor;
 IF NOT FOUND THEN RAISE EXCEPTION 'ATTENDANCE_UNAUTHORIZED: employee profile unavailable' USING ERRCODE='42501'; END IF;
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
   'policy',jsonb_build_object('radiusMeters',coalesce(nullif(branch.radius_meters,0),100),'maxAccuracyMeters',coalesce(policy.max_accuracy_meters,nullif(branch.radius_meters,0),100),'maxLocationAgeSeconds',coalesce(policy.max_location_age_seconds,30),'requireLocationMetadata',coalesce(policy.require_location_metadata,false)));
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
  VALUES(employee,branch.id,chosen.id,now_at,latitude,longitude,true,false,'manual',p_entry_point,CASE WHEN accuracy IS NULL THEN 'legacy_metadata' ELSE 'verified' END,accuracy,captured,distance) RETURNING * INTO record;
 ELSIF action IN ('clock_out','admin_close') THEN
  IF record.check_out IS NULL THEN UPDATE public.attendance SET check_out=now_at WHERE id=record.id RETURNING * INTO record;
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
  VALUES(actor,actor_profile.store_id,'rejected_attempt','manual',CASE WHEN p_entry_point IN ('app_dashboard','server_action','admin_console') THEN p_entry_point END,
   CASE WHEN SQLERRM LIKE 'ATTENDANCE_%' OR SQLERRM LIKE 'SHIFT_%' THEN SQLERRM ELSE 'Attendance request could not be processed' END,
   jsonb_build_object('sqlstate',SQLSTATE),actor);
 END IF;
 RETURN jsonb_build_object('success',false,'error',CASE WHEN SQLERRM LIKE 'ATTENDANCE_%' OR SQLERRM LIKE 'SHIFT_%' THEN SQLERRM ELSE 'ATTENDANCE_INVALID_REQUEST: attendance request could not be processed' END,'code',SQLSTATE);
END $$;
CREATE OR REPLACE FUNCTION public.attendance_transition(p_command jsonb,p_operation_id uuid,p_entry_point text DEFAULT 'app_dashboard')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT hrm_private.attendance_transition(p_command,p_operation_id,p_entry_point);
$$;
REVOKE ALL ON FUNCTION public.attendance_transition(jsonb,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.attendance_transition(jsonb,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION hrm_private.attendance_transition(jsonb,uuid,text) FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA hrm_private TO authenticated;
GRANT EXECUTE ON FUNCTION hrm_private.attendance_transition(jsonb,uuid,text) TO authenticated;
REVOKE ALL ON FUNCTION hrm_private.attendance_shift_start(public.shifts),hrm_private.attendance_shift_end(public.shifts),hrm_private.attendance_write_guard(),hrm_private.attendance_audit_write(),hrm_private.attendance_immutable_audit() FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
