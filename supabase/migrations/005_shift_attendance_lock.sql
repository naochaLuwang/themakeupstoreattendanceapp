-- Apply independently of the operations migrations: requires existing profiles,
-- shifts, attendance and swap_requests. Does not rewrite times or attendance.
BEGIN;

ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS attendance_started_at timestamptz;
ALTER TABLE public.swap_requests ADD COLUMN IF NOT EXISTS shift_snapshot jsonb;

CREATE SCHEMA IF NOT EXISTS hrm_private;
REVOKE ALL ON SCHEMA hrm_private FROM PUBLIC, anon, authenticated;

-- Existing schedules use the UTC date part as their wall-clock schedule date.
-- Attendance events are actual instants; legacy unlinked events use the IST day.
CREATE OR REPLACE FUNCTION hrm_private.shift_attendance_start(s public.shifts)
RETURNS timestamptz LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path = '' SET timezone = 'UTC' AS $$
  SELECT min(a.check_in::timestamptz) FROM public.attendance a
  WHERE a.shift_id = s.id OR (
    a.employee_id = s.employee_id
    AND (a.shift_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.shifts linked WHERE linked.id = a.shift_id))
    AND (a.check_in::timestamptz AT TIME ZONE 'Asia/Kolkata')::date = (s.start_time::timestamptz AT TIME ZONE 'UTC')::date
  );
$$;

UPDATE public.shifts s SET attendance_started_at = hrm_private.shift_attendance_start(s)
WHERE s.attendance_started_at IS NULL AND hrm_private.shift_attendance_start(s) IS NOT NULL;

CREATE OR REPLACE FUNCTION hrm_private.guard_worked_shift()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE locked boolean;
BEGIN
  -- A short transaction mutex also covers dates that currently have no shift row.
  -- The RPC takes it before row locks; direct concurrent DML may be retried if
  -- PostgreSQL detects a deadlock, but cannot commit an inconsistent schedule.
  PERFORM pg_catalog.pg_advisory_xact_lock(748913, 1);
  IF TG_OP = 'INSERT' THEN
    IF NEW.attendance_started_at IS NOT NULL OR hrm_private.shift_attendance_start(NEW) IS NOT NULL THEN
      RAISE EXCEPTION 'SHIFT_ATTENDANCE_LOCKED: attendance already exists for this schedule' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  locked := OLD.attendance_started_at IS NOT NULL OR hrm_private.shift_attendance_start(OLD) IS NOT NULL;
  IF TG_OP = 'DELETE' THEN
    IF locked THEN RAISE EXCEPTION 'SHIFT_ATTENDANCE_LOCKED: a worked shift cannot be deleted' USING ERRCODE = '23514'; END IF;
    RETURN OLD;
  END IF;
  IF NEW.attendance_started_at IS DISTINCT FROM OLD.attendance_started_at
     AND NOT (pg_catalog.pg_trigger_depth() > 1 AND OLD.attendance_started_at IS NULL AND NEW.attendance_started_at IS NOT NULL) THEN
    RAISE EXCEPTION 'SHIFT_ATTENDANCE_LOCKED: attendance lock is maintained by attendance events' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW.id, NEW.employee_id, NEW.start_time, NEW.end_time, NEW.shift_label)
      IS DISTINCT FROM ROW(OLD.id, OLD.employee_id, OLD.start_time, OLD.end_time, OLD.shift_label) THEN
    IF locked OR hrm_private.shift_attendance_start(NEW) IS NOT NULL THEN
      RAISE EXCEPTION 'SHIFT_ATTENDANCE_LOCKED: attendance has already started for this shift' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION hrm_private.serialize_attendance_shift()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE linked public.shifts;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(748913, 1);
  IF NEW.shift_id IS NOT NULL THEN
    SELECT * INTO linked FROM public.shifts WHERE id = NEW.shift_id FOR UPDATE;
    IF NOT FOUND OR linked.employee_id IS DISTINCT FROM NEW.employee_id
       OR (linked.start_time::timestamptz AT TIME ZONE 'UTC')::date <> (NEW.check_in::timestamptz AT TIME ZONE 'Asia/Kolkata')::date THEN
      RAISE EXCEPTION 'SHIFT_SCHEDULE_STALE: reload the employee schedule before recording attendance' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION hrm_private.remember_attendance_shift()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET timezone = 'UTC' AS $$
BEGIN
  UPDATE public.shifts s SET attendance_started_at = NEW.check_in::timestamptz
  WHERE s.attendance_started_at IS NULL AND (
    s.id = NEW.shift_id OR (
      NEW.shift_id IS NULL AND s.employee_id = NEW.employee_id
      AND (s.start_time::timestamptz AT TIME ZONE 'UTC')::date = (NEW.check_in::timestamptz AT TIME ZONE 'Asia/Kolkata')::date
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION hrm_private.guard_shift_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE
  source public.shifts;
  affected public.shifts;
  dates date[];
  request_date date;
  snapshot jsonb := '[]'::jsonb;
  actor uuid := auth.uid();
  actor_role text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.id, NEW.requestor_id, NEW.receiver_id, NEW.shift_id, NEW.message, NEW.note, NEW.shift_snapshot)
       IS DISTINCT FROM ROW(OLD.id, OLD.requestor_id, OLD.receiver_id, OLD.shift_id, OLD.message, OLD.note, OLD.shift_snapshot) THEN
      RAISE EXCEPTION 'SHIFT_REQUEST_STALE: submitted requests cannot be rewritten' USING ERRCODE = '23514';
    END IF;
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
    IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'SHIFT_REQUEST_STALE: request is no longer pending' USING ERRCODE = '23514'; END IF;
  ELSIF NEW.status <> 'pending' OR (actor IS NOT NULL AND actor <> NEW.requestor_id) THEN
    RAISE EXCEPTION 'Only pending requests for the signed-in employee may be submitted' USING ERRCODE = '42501';
  END IF;
  IF actor IS NOT NULL THEN
    SELECT role INTO actor_role FROM public.profiles WHERE id = actor;
  ELSIF current_setting('role', true) NOT IN ('service_role', 'none') THEN
    RAISE EXCEPTION 'Sign in to manage shift requests' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'cancelled' AND actor = OLD.requestor_id THEN RETURN NEW; END IF;
    IF actor IS NOT NULL AND COALESCE(actor_role, '') NOT IN ('admin', 'manager') THEN
      RAISE EXCEPTION 'Only a manager or administrator can review requests' USING ERRCODE = '42501';
    END IF;
    IF actor IS NOT NULL THEN
      PERFORM hrm_private.assert_scheduler(OLD.requestor_id);
      IF OLD.receiver_id IS NOT NULL THEN PERFORM hrm_private.assert_scheduler(OLD.receiver_id); END IF;
    END IF;
    IF NEW.status = 'declined' THEN RETURN NEW; END IF;
  END IF;
  -- Re-entry is deliberately separate; this migration changes ordinary scheduling.
  IF COALESCE(NEW.message, '') LIKE 'OVERRIDE REQUEST%' THEN RETURN NEW; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(748913, 1);
  SELECT * INTO source FROM public.shifts WHERE id = NEW.shift_id FOR UPDATE;
  IF NOT FOUND OR source.employee_id IS DISTINCT FROM NEW.requestor_id THEN
    RAISE EXCEPTION 'SHIFT_SCHEDULE_STALE: shift no longer belongs to the requestor' USING ERRCODE = '23514';
  END IF;
  SELECT array_agg(DISTINCT match[1]::date) INTO dates
  FROM pg_catalog.regexp_matches(COALESCE(NEW.message, ''), '(\d{4}-\d{2}-\d{2})', 'g') AS match;
  dates := COALESCE(dates, ARRAY[]::date[]);
  dates := array_append(dates, (source.start_time::timestamptz AT TIME ZONE 'UTC')::date);
  FOREACH request_date IN ARRAY dates LOOP
    IF request_date < (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date THEN
      RAISE EXCEPTION 'Past shifts cannot be changed through an ordinary request' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.attendance a WHERE a.employee_id IN (NEW.requestor_id, NEW.receiver_id)
       AND a.shift_id IS NULL AND (a.check_in::timestamptz AT TIME ZONE 'Asia/Kolkata')::date = request_date) THEN
      RAISE EXCEPTION 'SHIFT_ATTENDANCE_LOCKED: attendance already exists on an affected date' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  FOR affected IN SELECT s.* FROM public.shifts s
    WHERE s.employee_id IN (NEW.requestor_id, NEW.receiver_id)
      AND (s.start_time::timestamptz AT TIME ZONE 'UTC')::date = ANY(dates)
    ORDER BY s.id FOR UPDATE LOOP
    IF affected.attendance_started_at IS NOT NULL OR hrm_private.shift_attendance_start(affected) IS NOT NULL THEN
      RAISE EXCEPTION 'SHIFT_ATTENDANCE_LOCKED: attendance has started on an affected shift' USING ERRCODE = '23514';
    END IF;
    snapshot := snapshot || jsonb_build_array(to_jsonb(affected) - 'attendance_started_at' - 'created_at');
  END LOOP;
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM public.swap_requests r WHERE r.requestor_id = NEW.requestor_id AND r.shift_id = NEW.shift_id
       AND r.status = 'pending' AND COALESCE(r.message, '') NOT LIKE 'OVERRIDE REQUEST%') THEN
      RAISE EXCEPTION 'A change request is already pending for this shift' USING ERRCODE = '23514';
    END IF;
    NEW.shift_snapshot := snapshot;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION hrm_private.assert_scheduler(employee uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor public.profiles; subject public.profiles;
BEGIN
  SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND OR actor.role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION 'Only an administrator or manager can manage schedules' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO subject FROM public.profiles WHERE id = employee;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found' USING ERRCODE = '23514'; END IF;
  IF actor.role = 'manager' AND (actor.store_id IS NULL OR actor.store_id IS DISTINCT FROM subject.store_id) THEN
    RAISE EXCEPTION 'Managers can only change schedules for their own store' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- The only privileged RPC implementation lives outside the exposed schema.
CREATE OR REPLACE FUNCTION hrm_private.commit_shift_changes(
  p_changes jsonb, p_expected jsonb, p_request_id uuid, p_decision text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' SET timezone = 'UTC' AS $$
DECLARE
  item jsonb;
  saved public.shifts;
  wanted public.shifts;
  request public.swap_requests;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(748913, 1);
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to manage schedules' USING ERRCODE = '42501'; END IF;
  IF jsonb_typeof(p_changes) IS DISTINCT FROM 'array' OR jsonb_typeof(p_expected) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_changes) > 62 OR jsonb_array_length(p_expected) > 62 THEN
    RAISE EXCEPTION 'Invalid schedule batch' USING ERRCODE = '22023';
  END IF;
  -- Role check also applies to empty batches and declined requests.
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')) THEN
    RAISE EXCEPTION 'Only an administrator or manager can manage schedules' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NOT NULL THEN
    SELECT * INTO request FROM public.swap_requests WHERE id = p_request_id FOR UPDATE;
    IF NOT FOUND OR request.status <> 'pending' THEN RAISE EXCEPTION 'SHIFT_REQUEST_STALE: request is no longer pending' USING ERRCODE = '23514'; END IF;
    PERFORM hrm_private.assert_scheduler(request.requestor_id);
    IF request.receiver_id IS NOT NULL THEN PERFORM hrm_private.assert_scheduler(request.receiver_id); END IF;
    IF p_decision IS NULL OR p_decision NOT IN ('approved', 'declined') THEN RAISE EXCEPTION 'Invalid request decision' USING ERRCODE = '22023'; END IF;
    IF p_decision = 'declined' THEN
      IF jsonb_array_length(p_changes) <> 0 THEN RAISE EXCEPTION 'Declined requests cannot change schedules' USING ERRCODE = '22023'; END IF;
      UPDATE public.swap_requests SET status = 'declined' WHERE id = p_request_id;
      RETURN;
    END IF;
    IF COALESCE(request.message, '') LIKE 'OVERRIDE REQUEST%' THEN RAISE EXCEPTION 'Use the attendance re-entry workflow for overrides' USING ERRCODE = '22023'; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_expected) e WHERE (e->>'id')::uuid = request.shift_id)
       OR jsonb_array_length(p_changes) = 0 THEN RAISE EXCEPTION 'Invalid request schedule changes' USING ERRCODE = '22023'; END IF;
    IF request.shift_snapshot IS NOT NULL AND
       (SELECT jsonb_agg(value->>'id' ORDER BY value->>'id') FROM jsonb_array_elements(request.shift_snapshot))
       IS DISTINCT FROM (SELECT jsonb_agg(value->>'id' ORDER BY value->>'id') FROM jsonb_array_elements(p_expected)) THEN
      RAISE EXCEPTION 'SHIFT_SCHEDULE_STALE: an affected day now has a different set of shifts' USING ERRCODE = '23514';
    END IF;
    -- New requests retain their original schedule. Older pending requests are
    -- still checked against freshly loaded expected rows and attendance locks.
    FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(request.shift_snapshot, '[]'::jsonb)) LOOP
      SELECT * INTO saved FROM public.shifts WHERE id = (item->>'id')::uuid FOR UPDATE;
      wanted := jsonb_populate_record(NULL::public.shifts, item);
      IF NOT FOUND OR ROW(saved.employee_id, saved.start_time, saved.end_time, saved.shift_label, saved.status)
        IS DISTINCT FROM ROW(wanted.employee_id, wanted.start_time, wanted.end_time, wanted.shift_label, wanted.status) THEN
        RAISE EXCEPTION 'SHIFT_SCHEDULE_STALE: request was created for a different schedule' USING ERRCODE = '23514';
      END IF;
    END LOOP;
  ELSIF p_decision IS NOT NULL THEN RAISE EXCEPTION 'Request decision requires a request ID' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_changes)) <>
     (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_changes)) THEN
    RAISE EXCEPTION 'Duplicate schedule IDs' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_expected) ORDER BY value->>'id' LOOP
    SELECT * INTO saved FROM public.shifts WHERE id = (item->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'SHIFT_SCHEDULE_STALE: shift no longer exists' USING ERRCODE = '23514'; END IF;
    wanted := jsonb_populate_record(NULL::public.shifts, item);
    IF ROW(saved.employee_id, saved.start_time, saved.end_time, saved.shift_label, saved.status)
       IS DISTINCT FROM ROW(wanted.employee_id, wanted.start_time, wanted.end_time, wanted.shift_label, wanted.status) THEN
      RAISE EXCEPTION 'SHIFT_SCHEDULE_STALE: shift changed since it was loaded' USING ERRCODE = '23514';
    END IF;
    PERFORM hrm_private.assert_scheduler(saved.employee_id);
  END LOOP;
  -- Set the status first so the request trigger checks its original source.
  -- A later write/constraint error rolls back the status and EVERY shift change.
  IF p_request_id IS NOT NULL THEN UPDATE public.swap_requests SET status = 'approved' WHERE id = p_request_id; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_changes) ORDER BY value->>'id' LOOP
    SELECT * INTO saved FROM public.shifts WHERE id = (item->>'id')::uuid FOR UPDATE;
    IF FOUND THEN
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_expected) e WHERE e->>'id' = item->>'id') THEN
        RAISE EXCEPTION 'SHIFT_SCHEDULE_STALE: unexpected existing shift' USING ERRCODE = '23514';
      END IF;
      PERFORM hrm_private.assert_scheduler(saved.employee_id);
    ELSIF item->>'deleted' = 'true' THEN RAISE EXCEPTION 'SHIFT_SCHEDULE_STALE: deleted shift no longer exists' USING ERRCODE = '23514';
    END IF;
    IF item->>'deleted' = 'true' THEN DELETE FROM public.shifts WHERE id = saved.id;
    ELSE
      wanted := jsonb_populate_record(NULL::public.shifts, item);
      PERFORM hrm_private.assert_scheduler(wanted.employee_id);
      IF wanted.id IS NULL OR wanted.start_time IS NULL OR wanted.end_time IS NULL OR wanted.end_time <= wanted.start_time THEN
        RAISE EXCEPTION 'A shift requires valid start and end times' USING ERRCODE = '22023';
      END IF;
      IF saved.id IS NULL THEN
        INSERT INTO public.shifts(id, employee_id, start_time, end_time, shift_label, status)
        VALUES(wanted.id, wanted.employee_id, wanted.start_time, wanted.end_time, wanted.shift_label, wanted.status);
      ELSE
        UPDATE public.shifts SET employee_id = wanted.employee_id, start_time = wanted.start_time,
          end_time = wanted.end_time, shift_label = wanted.shift_label, status = wanted.status WHERE id = wanted.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.commit_shift_changes(
  p_changes jsonb, p_expected jsonb, p_request_id uuid DEFAULT NULL, p_decision text DEFAULT NULL
) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT hrm_private.commit_shift_changes(p_changes, p_expected, p_request_id, p_decision);
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA hrm_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA hrm_private TO authenticated;
GRANT EXECUTE ON FUNCTION hrm_private.commit_shift_changes(jsonb, jsonb, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.commit_shift_changes(jsonb, jsonb, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commit_shift_changes(jsonb, jsonb, uuid, text) TO authenticated;

DROP TRIGGER IF EXISTS hrm_guard_worked_shift ON public.shifts;
CREATE TRIGGER hrm_guard_worked_shift BEFORE INSERT OR UPDATE OR DELETE ON public.shifts
FOR EACH ROW EXECUTE FUNCTION hrm_private.guard_worked_shift();
DROP TRIGGER IF EXISTS hrm_serialize_attendance_shift ON public.attendance;
CREATE TRIGGER hrm_serialize_attendance_shift BEFORE INSERT OR UPDATE OF employee_id, shift_id, check_in ON public.attendance
FOR EACH ROW EXECUTE FUNCTION hrm_private.serialize_attendance_shift();
DROP TRIGGER IF EXISTS hrm_remember_attendance_shift ON public.attendance;
CREATE TRIGGER hrm_remember_attendance_shift AFTER INSERT OR UPDATE OF employee_id, shift_id, check_in ON public.attendance
FOR EACH ROW EXECUTE FUNCTION hrm_private.remember_attendance_shift();
DROP TRIGGER IF EXISTS hrm_guard_shift_request ON public.swap_requests;
CREATE TRIGGER hrm_guard_shift_request BEFORE INSERT OR UPDATE ON public.swap_requests
FOR EACH ROW EXECUTE FUNCTION hrm_private.guard_shift_request();

COMMENT ON COLUMN public.shifts.attendance_started_at IS 'Permanent ordinary-schedule lock, backfilled and set by attendance events. Retained after checkout, correction or attendance deletion.';
COMMENT ON COLUMN public.swap_requests.shift_snapshot IS 'Original affected schedules for stale-approval detection; maintained by request trigger.';
NOTIFY pgrst, 'reload schema';
COMMIT;
