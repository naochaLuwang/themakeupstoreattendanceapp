-- Durable attendance reminders. No branch is enabled and no scheduler is installed.
BEGIN;
DO $$ BEGIN IF to_regprocedure('public.attendance_smart_scan(jsonb,uuid)') IS NULL THEN RAISE EXCEPTION 'Apply the Smart Scan migration first'; END IF; END $$;
CREATE TABLE IF NOT EXISTS public.attendance_reminder_settings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id), enabled boolean NOT NULL DEFAULT false,
 upcoming_minutes integer NOT NULL DEFAULT 15 CHECK(upcoming_minutes BETWEEN 0 AND 120),
 missed_in_minutes integer NOT NULL DEFAULT 5 CHECK(missed_in_minutes BETWEEN 0 AND 120),
 late_minutes integer NOT NULL DEFAULT 30 CHECK(late_minutes BETWEEN 1 AND 240),
 ending_minutes integer NOT NULL DEFAULT 5 CHECK(ending_minutes BETWEEN 0 AND 120),
 missed_out_minutes integer NOT NULL DEFAULT 15 CHECK(missed_out_minutes BETWEEN 0 AND 240),
 unresolved_minutes integer NOT NULL DEFAULT 60 CHECK(unresolved_minutes BETWEEN 1 AND 1440),
 cooldown_minutes integer NOT NULL DEFAULT 15 CHECK(cooldown_minutes BETWEEN 0 AND 120),
 delivery_window_minutes integer NOT NULL DEFAULT 30 CHECK(delivery_window_minutes BETWEEN 5 AND 120),
 last_planned_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by uuid,
 CHECK(late_minutes>=missed_in_minutes),CHECK(unresolved_minutes>=missed_out_minutes)
);
CREATE TABLE IF NOT EXISTS public.attendance_notification_preferences (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),
 enabled boolean NOT NULL DEFAULT true, upcoming_shift boolean NOT NULL DEFAULT true, missed_clock_in boolean NOT NULL DEFAULT true,
 shift_ending boolean NOT NULL DEFAULT true, missed_clock_out boolean NOT NULL DEFAULT true, manager_alerts boolean NOT NULL DEFAULT true,
 quiet_start integer CHECK(quiet_start BETWEEN 0 AND 1439),quiet_end integer CHECK(quiet_end BETWEEN 0 AND 1439),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by uuid,
 CHECK((quiet_start IS NULL AND quiet_end IS NULL) OR (quiet_start IS NOT NULL AND quiet_end IS NOT NULL AND quiet_start<>quiet_end))
);
CREATE TABLE IF NOT EXISTS public.attendance_notification_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id), provider text NOT NULL CHECK(provider IN ('fcm','webpush')),
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 80), enabled boolean NOT NULL DEFAULT true,
 last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(), revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by uuid
);
CREATE TABLE IF NOT EXISTS hrm_private.attendance_notification_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id uuid NOT NULL UNIQUE REFERENCES public.attendance_notification_devices(id),
 installation_hash text NOT NULL UNIQUE CHECK(installation_hash~'^[a-f0-9]{64}$'),credential_hash text NOT NULL UNIQUE CHECK(credential_hash~'^[a-f0-9]{64}$'),
 credential jsonb NOT NULL,revision uuid NOT NULL DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),created_by uuid
);
CREATE TABLE IF NOT EXISTS hrm_private.attendance_reminder_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),dedupe_key text NOT NULL UNIQUE,store_id uuid NOT NULL,shift_id uuid NOT NULL,employee_id uuid NOT NULL,recipient_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('upcoming_shift','missed_clock_in','late_arrival','shift_ending','missed_clock_out','unresolved_attendance','reentry_approved')),
 schedule_start timestamptz NOT NULL,schedule_end timestamptz,source_operation_id uuid,
 due_at timestamptz NOT NULL,expires_at timestamptz NOT NULL,available_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','notified','suppressed')),reason text,notified_at timestamptz,notification_id uuid,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),created_by uuid
);
CREATE TABLE IF NOT EXISTS hrm_private.attendance_push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid NOT NULL REFERENCES hrm_private.attendance_reminder_jobs(id),device_id uuid NOT NULL REFERENCES public.attendance_notification_devices(id),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','leased','sent','dead','suppressed','blocked_configuration')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),available_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 lease_token uuid,lease_until timestamptz,credential_revision uuid,sent_at timestamptz,error_code text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),created_by uuid,
 UNIQUE(job_id,device_id)
);
CREATE INDEX IF NOT EXISTS attendance_reminder_due ON hrm_private.attendance_reminder_jobs(available_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS attendance_reminder_cooldown ON hrm_private.attendance_reminder_jobs(recipient_id,employee_id,notified_at DESC);
CREATE INDEX IF NOT EXISTS attendance_push_due ON hrm_private.attendance_push_deliveries(available_at,lease_until) WHERE status IN ('pending','leased','blocked_configuration');
CREATE INDEX IF NOT EXISTS attendance_notification_device_owner ON public.attendance_notification_devices(user_id,enabled);
ALTER TABLE public.attendance_reminder_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_notification_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrm_private.attendance_notification_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrm_private.attendance_reminder_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrm_private.attendance_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_reminder_settings,public.attendance_notification_preferences,public.attendance_notification_devices FROM PUBLIC,anon,authenticated;
REVOKE ALL ON hrm_private.attendance_notification_keys,hrm_private.attendance_reminder_jobs,hrm_private.attendance_push_deliveries FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.attendance_reminder_settings,public.attendance_notification_preferences,public.attendance_notification_devices TO authenticated;
DROP POLICY IF EXISTS reminder_settings_admin ON public.attendance_reminder_settings;
CREATE POLICY reminder_settings_admin ON public.attendance_reminder_settings FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid()) AND role='admin'));
DROP POLICY IF EXISTS notification_preferences_own ON public.attendance_notification_preferences;
CREATE POLICY notification_preferences_own ON public.attendance_notification_preferences FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS notification_devices_own ON public.attendance_notification_devices;
CREATE POLICY notification_devices_own ON public.attendance_notification_devices FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));

-- Extend the existing operations notification history, without changing legacy rows.
CREATE TABLE IF NOT EXISTS public.notification_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid REFERENCES public.profiles(id),title text NOT NULL,body text,type text,link text,is_read boolean DEFAULT false,created_at timestamptz DEFAULT now());
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT clock_timestamp();
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS attendance_reminder_id uuid UNIQUE REFERENCES hrm_private.attendance_reminder_jobs(id);
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS attendance_store_id uuid;
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS attendance_manager_alert boolean NOT NULL DEFAULT false;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT,UPDATE ON public.notification_log TO authenticated;
DROP POLICY IF EXISTS attendance_notification_own_read ON public.notification_log;
CREATE POLICY attendance_notification_own_read ON public.notification_log FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS attendance_notification_own_update ON public.notification_log;
CREATE POLICY attendance_notification_own_update ON public.notification_log FOR UPDATE TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
-- Restrictive policies constrain even the permissive legacy operations policies.
DROP POLICY IF EXISTS attendance_notification_recipient ON public.notification_log;
CREATE POLICY attendance_notification_recipient ON public.notification_log AS RESTRICTIVE FOR ALL TO authenticated
 USING(attendance_reminder_id IS NULL OR (user_id=(SELECT auth.uid()) AND (NOT attendance_manager_alert OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND (p.role='admin' OR (p.role='manager' AND p.store_id=attendance_store_id))))))
 WITH CHECK(attendance_reminder_id IS NULL OR user_id=(SELECT auth.uid()));
CREATE OR REPLACE FUNCTION hrm_private.protect_attendance_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF current_setting('role',true) IN ('none','service_role') THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
 IF TG_OP='INSERT' AND NEW.attendance_reminder_id IS NOT NULL THEN RAISE EXCEPTION 'Attendance reminders are created by the reminder worker' USING ERRCODE='42501'; END IF;
 IF TG_OP='UPDATE' AND (OLD.attendance_reminder_id IS NOT NULL OR NEW.attendance_reminder_id IS NOT NULL) THEN
  IF OLD.user_id IS DISTINCT FROM auth.uid() OR (to_jsonb(NEW)-'is_read'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'is_read'-'updated_at') THEN RAISE EXCEPTION 'Only reminder read status can be changed' USING ERRCODE='42501'; END IF;
  NEW.updated_at:=clock_timestamp();
 END IF;
 IF TG_OP='DELETE' AND OLD.attendance_reminder_id IS NOT NULL THEN RAISE EXCEPTION 'Attendance reminder history is retained' USING ERRCODE='42501'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS protect_attendance_reminder_history ON public.notification_log;
CREATE TRIGGER protect_attendance_reminder_history BEFORE INSERT OR UPDATE OR DELETE ON public.notification_log FOR EACH ROW EXECUTE FUNCTION hrm_private.protect_attendance_notification();
REVOKE ALL ON FUNCTION hrm_private.protect_attendance_notification() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION hrm_private.reminder_due(kind text,start_at timestamptz,end_at timestamptz,settings public.attendance_reminder_settings)
RETURNS timestamptz LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT CASE kind
 WHEN 'upcoming_shift' THEN start_at-make_interval(mins=>settings.upcoming_minutes)
 WHEN 'missed_clock_in' THEN start_at+make_interval(mins=>settings.missed_in_minutes)
 WHEN 'late_arrival' THEN start_at+make_interval(mins=>settings.late_minutes)
 WHEN 'shift_ending' THEN end_at-make_interval(mins=>settings.ending_minutes)
 WHEN 'missed_clock_out' THEN end_at+make_interval(mins=>settings.missed_out_minutes)
 WHEN 'unresolved_attendance' THEN end_at+make_interval(mins=>settings.unresolved_minutes) END $$;

CREATE OR REPLACE FUNCTION hrm_private.reminder_eligibility(job hrm_private.attendance_reminder_jobs)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE employee public.profiles;recipient public.profiles;assigned public.shifts;settings public.attendance_reminder_settings;prefs public.attendance_notification_preferences;
 stamp timestamptz:=clock_timestamp();due timestamptz;defer_until timestamptz;local_now timestamp;minute integer;has_attendance boolean;has_active boolean;
BEGIN
 SELECT * INTO settings FROM public.attendance_reminder_settings WHERE store_id=job.store_id;
 SELECT * INTO employee FROM public.profiles WHERE id=job.employee_id;
 SELECT * INTO recipient FROM public.profiles WHERE id=job.recipient_id;
 SELECT * INTO assigned FROM public.shifts WHERE id=job.shift_id;
 SELECT * INTO prefs FROM public.attendance_notification_preferences WHERE user_id=job.recipient_id;
 IF NOT coalesce(settings.enabled,false) OR employee.id IS NULL OR recipient.id IS NULL OR assigned.id IS NULL OR employee.store_id IS DISTINCT FROM job.store_id OR assigned.employee_id IS DISTINCT FROM job.employee_id
 OR hrm_private.attendance_shift_start(assigned) IS DISTINCT FROM job.schedule_start OR hrm_private.attendance_shift_end(assigned) IS DISTINCT FROM job.schedule_end THEN RETURN jsonb_build_object('eligible',false,'reason','schedule_or_branch_changed'); END IF;
 IF job.kind IN ('late_arrival','unresolved_attendance') THEN
  IF NOT ((recipient.role='manager' AND recipient.store_id=job.store_id) OR (recipient.role='admin' AND (recipient.store_id IS NULL OR recipient.store_id=job.store_id))) THEN RETURN jsonb_build_object('eligible',false,'reason','recipient_not_authorized'); END IF;
 ELSE IF job.recipient_id<>job.employee_id THEN RETURN jsonb_build_object('eligible',false,'reason','wrong_recipient'); END IF; END IF;
 IF prefs.enabled=false OR (job.kind IN ('upcoming_shift','missed_clock_in','shift_ending','missed_clock_out') AND (to_jsonb(prefs)->>job.kind)::boolean=false)
 OR (job.kind IN ('late_arrival','unresolved_attendance') AND prefs.manager_alerts=false) THEN RETURN jsonb_build_object('eligible',false,'reason','preferences_disabled'); END IF;
 IF EXISTS(SELECT 1 FROM public.leave_requests WHERE employee_id=employee.id AND status='approved' AND start_date<=(assigned.start_time AT TIME ZONE 'UTC')::date AND end_date>=(assigned.start_time AT TIME ZONE 'UTC')::date) THEN RETURN jsonb_build_object('eligible',false,'reason','approved_leave'); END IF;
 IF job.expires_at<=stamp THEN RETURN jsonb_build_object('eligible',false,'reason','expired'); END IF;
 IF job.kind='reentry_approved' THEN
  IF NOT EXISTS(SELECT 1 FROM public.attendance_operations WHERE id=job.source_operation_id AND action='approve_reentry' AND employee_id=employee.id AND response->>'success'='true') THEN RETURN jsonb_build_object('eligible',false,'reason','source_unavailable'); END IF;
 ELSE
  due:=hrm_private.reminder_due(job.kind,job.schedule_start,job.schedule_end,settings);
  IF due IS NULL THEN RETURN jsonb_build_object('eligible',false,'reason','no_scheduled_end'); END IF;
  IF stamp<due THEN RETURN jsonb_build_object('eligible',false,'reason','not_due','deferUntil',due); END IF;
  SELECT EXISTS(SELECT 1 FROM public.attendance a WHERE a.employee_id=employee.id AND (a.shift_id=assigned.id OR (a.shift_id IS NULL AND (a.check_in AT TIME ZONE 'Asia/Kolkata')::date=(assigned.start_time AT TIME ZONE 'UTC')::date))) INTO has_attendance;
  SELECT EXISTS(SELECT 1 FROM public.attendance a WHERE a.employee_id=employee.id AND a.check_out IS NULL AND a.store_id=job.store_id AND (a.shift_id=assigned.id OR (a.shift_id IS NULL AND (a.check_in AT TIME ZONE 'Asia/Kolkata')::date=(assigned.start_time AT TIME ZONE 'UTC')::date))) INTO has_active;
  IF job.kind IN ('upcoming_shift','missed_clock_in','late_arrival') AND (has_attendance OR (job.kind<>'late_arrival' AND EXISTS(SELECT 1 FROM public.attendance WHERE employee_id=employee.id AND check_out IS NULL))) THEN RETURN jsonb_build_object('eligible',false,'reason','attendance_already_started'); END IF;
  IF job.kind IN ('shift_ending','missed_clock_out','unresolved_attendance') AND NOT has_active THEN RETURN jsonb_build_object('eligible',false,'reason','no_active_session'); END IF;
 END IF;
 IF prefs.quiet_start IS NOT NULL THEN
  local_now:=stamp AT TIME ZONE 'Asia/Kolkata';minute:=extract(hour FROM local_now)::integer*60+extract(minute FROM local_now)::integer;
  IF (prefs.quiet_start<prefs.quiet_end AND minute>=prefs.quiet_start AND minute<prefs.quiet_end) OR (prefs.quiet_start>prefs.quiet_end AND (minute>=prefs.quiet_start OR minute<prefs.quiet_end)) THEN
   defer_until:=(local_now::date+make_interval(mins=>prefs.quiet_end)+CASE WHEN prefs.quiet_start>prefs.quiet_end AND minute>=prefs.quiet_start THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE 'Asia/Kolkata';
  END IF;
 END IF;
 IF job.notified_at IS NULL THEN SELECT greatest(defer_until,max(notified_at)+make_interval(mins=>settings.cooldown_minutes)) INTO defer_until FROM hrm_private.attendance_reminder_jobs WHERE recipient_id=job.recipient_id AND employee_id=job.employee_id AND id<>job.id AND notified_at>stamp-make_interval(mins=>settings.cooldown_minutes); END IF;
 IF defer_until>stamp THEN RETURN jsonb_build_object('eligible',false,'reason','quiet_hours_or_cooldown','deferUntil',defer_until); END IF;
 RETURN jsonb_build_object('eligible',true);
END $$;

CREATE OR REPLACE FUNCTION hrm_private.attendance_notification_user(p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<enrollment>>
DECLARE actor uuid:=auth.uid();action text:=p_command->>'action';prefs public.attendance_notification_preferences;device public.attendance_notification_devices;key hrm_private.attendance_notification_keys;
 secret text:=p_command->>'installationSecret';hash text;credential jsonb;provider text;credential_hash text;stamp timestamptz:=clock_timestamp();
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor) THEN RAISE EXCEPTION 'REMINDER_UNAUTHORIZED: sign in to manage notifications' USING ERRCODE='42501'; END IF;
 IF p_command IS NULL OR pg_column_size(p_command)>16384 THEN RAISE EXCEPTION 'REMINDER_INVALID: invalid notification request' USING ERRCODE='22023'; END IF;
 IF secret~'^[a-f0-9]{64}$' THEN hash:=encode(sha256(convert_to(secret,'UTF8')),'hex'); END IF;
 IF action='preferences' THEN
  INSERT INTO public.attendance_notification_preferences(user_id,enabled,upcoming_shift,missed_clock_in,shift_ending,missed_clock_out,manager_alerts,quiet_start,quiet_end,created_by)
   VALUES(actor,(p_command->>'enabled')::boolean,(p_command->>'upcoming_shift')::boolean,(p_command->>'missed_clock_in')::boolean,(p_command->>'shift_ending')::boolean,(p_command->>'missed_clock_out')::boolean,(p_command->>'manager_alerts')::boolean,(p_command->>'quiet_start')::integer,(p_command->>'quiet_end')::integer,actor)
   ON CONFLICT(user_id) DO UPDATE SET enabled=EXCLUDED.enabled,upcoming_shift=EXCLUDED.upcoming_shift,missed_clock_in=EXCLUDED.missed_clock_in,shift_ending=EXCLUDED.shift_ending,missed_clock_out=EXCLUDED.missed_clock_out,manager_alerts=EXCLUDED.manager_alerts,quiet_start=EXCLUDED.quiet_start,quiet_end=EXCLUDED.quiet_end,updated_at=stamp;
  UPDATE hrm_private.attendance_reminder_jobs SET available_at=least(available_at,stamp),reason=NULL WHERE recipient_id=actor AND status='pending';
 ELSIF action IN ('register','sync','detach') THEN
  IF hash IS NULL THEN RAISE EXCEPTION 'REMINDER_INVALID: device enrollment is required' USING ERRCODE='22023'; END IF;
  -- Serialize installation/token ownership changes; never expose hashes to clients.
  PERFORM pg_catalog.pg_advisory_xact_lock(748914,2);
  SELECT * INTO key FROM hrm_private.attendance_notification_keys WHERE installation_hash=hash FOR UPDATE;
  IF key.id IS NOT NULL THEN SELECT * INTO device FROM public.attendance_notification_devices WHERE id=key.device_id FOR UPDATE; END IF;
  IF device.id IS NOT NULL AND device.user_id<>actor AND action IN ('sync','register') THEN
   -- Keep each account's public metadata separate; do not disclose the previous
   -- account's creator ID or personal device name to the new signed-in user.
   UPDATE public.attendance_notification_devices SET enabled=false,revoked_at=stamp,updated_at=stamp WHERE id=device.id;
   INSERT INTO public.attendance_notification_devices(user_id,provider,name,enabled,revoked_at,created_by)
    VALUES(actor,device.provider,CASE WHEN device.provider='fcm' THEN 'Android app' ELSE 'This browser' END,false,stamp,actor) RETURNING * INTO device;
   UPDATE hrm_private.attendance_notification_keys SET device_id=device.id,revision=gen_random_uuid(),updated_at=stamp WHERE id=key.id;
  END IF;
  IF action='detach' THEN
   IF device.user_id=actor THEN UPDATE public.attendance_notification_devices SET enabled=false,revoked_at=stamp,updated_at=stamp WHERE id=device.id; END IF;
  ELSIF action='sync' THEN
   IF device.id IS NOT NULL THEN
    IF device.user_id<>actor THEN UPDATE public.attendance_notification_devices SET user_id=actor,enabled=false,revoked_at=stamp,updated_at=stamp,last_seen_at=stamp WHERE id=device.id;
    ELSE UPDATE public.attendance_notification_devices SET last_seen_at=stamp WHERE id=device.id; END IF;
   END IF;
  ELSE
   provider:=p_command->>'provider';credential:=p_command->'credential';
   IF provider NOT IN ('fcm','webpush') OR provider IS NULL OR length(btrim(coalesce(p_command->>'name',''))) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'REMINDER_INVALID: valid device name and provider required' USING ERRCODE='22023'; END IF;
   IF provider='fcm' THEN
    IF coalesce(credential->>'token','') !~ '^[A-Za-z0-9_:.-]+$' OR length(credential->>'token') NOT BETWEEN 20 AND 4096 THEN RAISE EXCEPTION 'REMINDER_INVALID: invalid push registration' USING ERRCODE='22023'; END IF;
    credential_hash:=encode(sha256(convert_to(credential->>'token','UTF8')),'hex');
   ELSE
    IF coalesce(credential->>'endpoint','') !~ '^https://(fcm\.googleapis\.com|[a-z0-9-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/[^[:space:]#]+$'
     OR length(credential->>'endpoint')>4096 OR coalesce(credential->'keys'->>'p256dh','') !~ '^[A-Za-z0-9_-]{87}=?$' OR coalesce(credential->'keys'->>'auth','') !~ '^[A-Za-z0-9_-]{22}(==)?$' THEN RAISE EXCEPTION 'REMINDER_INVALID: unsupported or invalid browser push registration' USING ERRCODE='22023'; END IF;
    credential_hash:=encode(sha256(convert_to(credential->>'endpoint','UTF8')),'hex');
   END IF;
   IF EXISTS(SELECT 1 FROM hrm_private.attendance_notification_keys k JOIN public.attendance_notification_devices d ON d.id=k.device_id WHERE k.credential_hash=enrollment.credential_hash AND k.installation_hash<>hash AND d.revoked_at IS NULL) THEN
    RAISE EXCEPTION 'REMINDER_DEVICE_BOUND: remove the previous registration before enrolling this device again' USING ERRCODE='23514'; END IF;
   -- A revoked token can safely be enrolled again with a new installation key.
   DELETE FROM hrm_private.attendance_notification_keys k USING public.attendance_notification_devices d WHERE k.device_id=d.id AND k.credential_hash=enrollment.credential_hash AND k.installation_hash<>hash AND d.revoked_at IS NOT NULL;
   IF (device.id IS NULL OR device.user_id<>actor OR NOT device.enabled) AND (SELECT count(*) FROM public.attendance_notification_devices WHERE user_id=actor AND enabled AND revoked_at IS NULL AND last_seen_at>stamp-interval '30 days' AND id IS DISTINCT FROM device.id)>=10 THEN
    RAISE EXCEPTION 'REMINDER_DEVICE_LIMIT: remove an unused device before adding another' USING ERRCODE='23514'; END IF;
   IF device.id IS NULL THEN
    INSERT INTO public.attendance_notification_devices(user_id,provider,name,created_by) VALUES(actor,provider,btrim(p_command->>'name'),actor) RETURNING * INTO device;
    INSERT INTO hrm_private.attendance_notification_keys(device_id,installation_hash,credential_hash,credential,created_by) VALUES(device.id,hash,credential_hash,credential,actor);
   ELSE
    UPDATE public.attendance_notification_devices SET user_id=actor,provider=enrollment.provider,name=btrim(p_command->>'name'),enabled=true,revoked_at=NULL,last_seen_at=stamp,updated_at=stamp WHERE id=device.id;
    UPDATE hrm_private.attendance_notification_keys k SET credential_hash=enrollment.credential_hash,credential=enrollment.credential,revision=CASE WHEN k.credential IS DISTINCT FROM enrollment.credential THEN gen_random_uuid() ELSE k.revision END,updated_at=stamp WHERE k.device_id=device.id;
   END IF;
  END IF;
 ELSIF action='revoke' THEN
  UPDATE public.attendance_notification_devices SET enabled=false,revoked_at=stamp,updated_at=stamp WHERE id=(p_command->>'deviceId')::uuid AND user_id=actor;
  IF NOT FOUND THEN RAISE EXCEPTION 'REMINDER_FORBIDDEN: this device is not registered to your account' USING ERRCODE='42501'; END IF;
 ELSIF action<>'config' OR action IS NULL THEN RAISE EXCEPTION 'REMINDER_INVALID: unknown notification action' USING ERRCODE='22023'; END IF;
 SELECT * INTO prefs FROM public.attendance_notification_preferences WHERE user_id=actor;
 RETURN jsonb_build_object('success',true,'data',jsonb_build_object('userId',actor,'preferences',CASE WHEN prefs.id IS NOT NULL THEN to_jsonb(prefs) ELSE jsonb_build_object('enabled',true,'upcoming_shift',true,'missed_clock_in',true,'shift_ending',true,'missed_clock_out',true,'manager_alerts',true,'quiet_start',NULL,'quiet_end',NULL) END,
  'devices',coalesce((SELECT jsonb_agg(to_jsonb(d)-'created_by') FROM public.attendance_notification_devices d WHERE d.user_id=actor),'[]'::jsonb),
  'currentDeviceId',(SELECT d.id FROM public.attendance_notification_devices d JOIN hrm_private.attendance_notification_keys k ON k.device_id=d.id WHERE k.installation_hash=hash AND d.user_id=actor),
  'branchEnabled',coalesce((SELECT enabled FROM public.attendance_reminder_settings WHERE store_id=(SELECT store_id FROM public.profiles WHERE id=actor)),false),
  'role',(SELECT role FROM public.profiles WHERE id=actor)));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'code',SQLSTATE,'error',CASE WHEN SQLERRM LIKE 'REMINDER_%' THEN SQLERRM ELSE 'REMINDER_INVALID: notification settings could not be saved' END);
END $$;

CREATE OR REPLACE FUNCTION hrm_private.attendance_reminder_admin(p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();action text:=p_command->>'action';settings public.attendance_reminder_settings;input jsonb:=p_command->'settings';
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND role='admin') THEN RAISE EXCEPTION 'REMINDER_FORBIDDEN: administrator access required' USING ERRCODE='42501'; END IF;
 IF p_command IS NULL OR pg_column_size(p_command)>8192 THEN RAISE EXCEPTION 'REMINDER_INVALID: invalid reminder settings' USING ERRCODE='22023'; END IF;
 IF action='save' THEN
  PERFORM pg_catalog.pg_advisory_xact_lock(748914,3);
  SELECT * INTO settings FROM public.attendance_reminder_settings WHERE store_id=(p_command->>'storeId')::uuid FOR UPDATE;
  IF settings.id IS NOT NULL AND settings.updated_at IS DISTINCT FROM (p_command->>'expectedUpdatedAt')::timestamptz THEN RAISE EXCEPTION 'REMINDER_STALE: branch settings changed; refresh before saving' USING ERRCODE='23514'; END IF;
  INSERT INTO public.attendance_reminder_settings(store_id,enabled,upcoming_minutes,missed_in_minutes,late_minutes,ending_minutes,missed_out_minutes,unresolved_minutes,cooldown_minutes,delivery_window_minutes,created_by)
   VALUES((p_command->>'storeId')::uuid,(input->>'enabled')::boolean,(input->>'upcoming_minutes')::integer,(input->>'missed_in_minutes')::integer,(input->>'late_minutes')::integer,(input->>'ending_minutes')::integer,(input->>'missed_out_minutes')::integer,(input->>'unresolved_minutes')::integer,(input->>'cooldown_minutes')::integer,(input->>'delivery_window_minutes')::integer,actor)
   ON CONFLICT(store_id) DO UPDATE SET enabled=EXCLUDED.enabled,upcoming_minutes=EXCLUDED.upcoming_minutes,missed_in_minutes=EXCLUDED.missed_in_minutes,late_minutes=EXCLUDED.late_minutes,ending_minutes=EXCLUDED.ending_minutes,missed_out_minutes=EXCLUDED.missed_out_minutes,unresolved_minutes=EXCLUDED.unresolved_minutes,cooldown_minutes=EXCLUDED.cooldown_minutes,delivery_window_minutes=EXCLUDED.delivery_window_minutes,updated_at=clock_timestamp();
  UPDATE hrm_private.attendance_reminder_jobs SET available_at=least(available_at,clock_timestamp()),reason=NULL WHERE store_id=(p_command->>'storeId')::uuid AND status='pending';
 ELSIF action<>'list' OR action IS NULL THEN RAISE EXCEPTION 'REMINDER_INVALID: unknown administrator action' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('success',true,'data',jsonb_build_object('stores',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'settings',to_jsonb(c),
  'pending',(SELECT count(*) FROM hrm_private.attendance_reminder_jobs WHERE store_id=s.id AND status='pending'),
  'sent',(SELECT count(*) FROM hrm_private.attendance_push_deliveries d JOIN hrm_private.attendance_reminder_jobs j ON j.id=d.job_id WHERE j.store_id=s.id AND d.status='sent'),
  'blocked',(SELECT count(*) FROM hrm_private.attendance_push_deliveries d JOIN hrm_private.attendance_reminder_jobs j ON j.id=d.job_id WHERE j.store_id=s.id AND d.status IN ('dead','blocked_configuration')))) FROM public.stores s LEFT JOIN public.attendance_reminder_settings c ON c.store_id=s.id),'[]'::jsonb)));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'code',SQLSTATE,'error',CASE WHEN SQLERRM LIKE 'REMINDER_%' THEN SQLERRM ELSE 'REMINDER_INVALID: branch reminder settings could not be saved' END);
END $$;

CREATE OR REPLACE FUNCTION hrm_private.attendance_reminder_worker(p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE action text:=p_command->>'action';stamp timestamptz:=clock_timestamp();assigned public.shifts;settings public.attendance_reminder_settings;
 job hrm_private.attendance_reminder_jobs;delivery hrm_private.attendance_push_deliveries;device public.attendance_notification_devices;key hrm_private.attendance_notification_keys;
 kind text;recipient uuid;start_at timestamptz;end_at timestamptz;due timestamptz;dedupe text;eligible jsonb;defer_until timestamptz;notice uuid;
 title text;body text;link text;items jsonb:='[]'::jsonb;count_planned integer:=0;outcome text;retry_seconds integer;is_manager boolean;source public.attendance_operations;
BEGIN
 IF current_setting('role',true) NOT IN ('service_role','none') THEN RAISE EXCEPTION 'REMINDER_FORBIDDEN: reminder worker access required' USING ERRCODE='42501'; END IF;
 IF p_command IS NULL OR pg_column_size(p_command)>8192 THEN RAISE EXCEPTION 'REMINDER_INVALID: invalid worker command' USING ERRCODE='22023'; END IF;
 IF action='plan' THEN
  IF NOT pg_catalog.pg_try_advisory_xact_lock(748914,1) THEN RETURN jsonb_build_object('success',true,'data',jsonb_build_object('busy',true,'planned',0)); END IF;
  FOR assigned IN SELECT s.* FROM public.shifts s JOIN public.profiles p ON p.id=s.employee_id JOIN public.attendance_reminder_settings c ON c.store_id=p.store_id
   WHERE c.enabled AND p.role IN ('employee','manager') AND s.start_time>=(stamp AT TIME ZONE 'Asia/Kolkata')::date-interval '2 days' AND s.start_time<(stamp AT TIME ZONE 'Asia/Kolkata')::date+interval '3 days' LOOP
   SELECT * INTO settings FROM public.attendance_reminder_settings WHERE store_id=(SELECT store_id FROM public.profiles WHERE id=assigned.employee_id);
   start_at:=hrm_private.attendance_shift_start(assigned::public.shifts);end_at:=hrm_private.attendance_shift_end(assigned::public.shifts);
   FOREACH kind IN ARRAY ARRAY['upcoming_shift','missed_clock_in','late_arrival','shift_ending','missed_clock_out','unresolved_attendance'] LOOP
    due:=hrm_private.reminder_due(kind,start_at,end_at,settings);IF due IS NULL THEN CONTINUE; END IF;
    FOR recipient IN SELECT id FROM public.profiles WHERE (kind NOT IN ('late_arrival','unresolved_attendance') AND id=assigned.employee_id)
      OR (kind IN ('late_arrival','unresolved_attendance') AND ((role='manager' AND store_id=settings.store_id) OR (role='admin' AND (store_id IS NULL OR store_id=settings.store_id)))) LOOP
     dedupe:=encode(sha256(convert_to(jsonb_build_array(assigned.id,assigned.employee_id,settings.store_id,start_at,end_at,kind,recipient)::text,'UTF8')),'hex');
     INSERT INTO hrm_private.attendance_reminder_jobs(dedupe_key,store_id,shift_id,employee_id,recipient_id,kind,schedule_start,schedule_end,due_at,expires_at,available_at)
      VALUES(dedupe,settings.store_id,assigned.id,assigned.employee_id,recipient,kind,start_at,end_at,due,due+make_interval(mins=>settings.delivery_window_minutes),due)
      ON CONFLICT(dedupe_key) DO UPDATE SET due_at=EXCLUDED.due_at,expires_at=EXCLUDED.expires_at,available_at=greatest(EXCLUDED.due_at,hrm_private.attendance_reminder_jobs.available_at),updated_at=stamp
       WHERE hrm_private.attendance_reminder_jobs.status='pending';
     count_planned:=count_planned+1;
    END LOOP;
   END LOOP;
  END LOOP;
  -- Actual trusted approval receipts, not arbitrary swap-request status changes.
  FOR source IN SELECT o.* FROM public.attendance_operations o WHERE o.action='approve_reentry' AND o.response->>'success'='true' AND o.created_at>stamp-interval '1 day' LOOP
   SELECT * INTO assigned FROM public.shifts WHERE id=(source.response->'data'->>'shift_id')::uuid;
   IF assigned.id IS NULL THEN CONTINUE; END IF;
   SELECT * INTO settings FROM public.attendance_reminder_settings WHERE store_id=(SELECT store_id FROM public.profiles WHERE id=source.employee_id) AND enabled;
   IF settings.id IS NULL THEN CONTINUE; END IF;
   INSERT INTO hrm_private.attendance_reminder_jobs(dedupe_key,store_id,shift_id,employee_id,recipient_id,kind,schedule_start,schedule_end,source_operation_id,due_at,expires_at,available_at)
    VALUES('reentry:'||source.id,settings.store_id,assigned.id,source.employee_id,source.employee_id,'reentry_approved',hrm_private.attendance_shift_start(assigned::public.shifts),hrm_private.attendance_shift_end(assigned::public.shifts),source.id,source.created_at,source.created_at+interval '1 day',source.created_at) ON CONFLICT(dedupe_key) DO NOTHING;
  END LOOP;
  UPDATE public.attendance_reminder_settings SET last_planned_at=stamp WHERE enabled;
  RETURN jsonb_build_object('success',true,'data',jsonb_build_object('planned',count_planned));
 ELSIF action='claim' THEN
  FOR job IN SELECT * FROM hrm_private.attendance_reminder_jobs WHERE status='pending' AND available_at<=stamp ORDER BY due_at,id LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
   -- Different event kinds for one employee/recipient share a cooldown lock.
   IF NOT pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(job.recipient_id::text||':'||job.employee_id::text,748914)) THEN CONTINUE; END IF;
   eligible:=hrm_private.reminder_eligibility(job);
   IF NOT (eligible->>'eligible')::boolean THEN
    defer_until:=(eligible->>'deferUntil')::timestamptz;
    IF defer_until IS NOT NULL AND defer_until<job.expires_at THEN UPDATE hrm_private.attendance_reminder_jobs SET available_at=defer_until,reason=eligible->>'reason',updated_at=stamp WHERE id=job.id;
    ELSE UPDATE hrm_private.attendance_reminder_jobs SET status='suppressed',reason=eligible->>'reason',updated_at=stamp WHERE id=job.id; END IF;
    CONTINUE;
   END IF;
   is_manager:=job.kind IN ('late_arrival','unresolved_attendance');
   title:=CASE job.kind WHEN 'upcoming_shift' THEN 'Review your upcoming shift' WHEN 'missed_clock_in' THEN 'Review your clock-in' WHEN 'shift_ending' THEN 'Review your shift finish' WHEN 'missed_clock_out' THEN 'Review your clock-out' WHEN 'reentry_approved' THEN 'Re-entry approved' ELSE 'Branch attendance needs review' END;
   body:=CASE WHEN is_manager THEN coalesce((SELECT full_name FROM public.profiles WHERE id=job.employee_id),'A team member')||' · Please review attendance for the assigned shift.' WHEN job.kind='reentry_approved' THEN 'Your approved session is available. Open Home to check its current status.' ELSE 'Open Home to check your current attendance. This reminder does not record or end a shift.' END;
   link:=CASE WHEN is_manager THEN CASE WHEN (SELECT role FROM public.profiles WHERE id=job.recipient_id)='admin' THEN '/admin/logs' ELSE '/employee/notifications' END ELSE '/employee' END;
   INSERT INTO public.notification_log(user_id,title,body,type,link,created_by,attendance_reminder_id,attendance_store_id,attendance_manager_alert)
    VALUES(job.recipient_id,title,body,'attendance_'||job.kind,link,job.recipient_id,job.id,job.store_id,is_manager) RETURNING id INTO notice;
   UPDATE hrm_private.attendance_reminder_jobs SET status='notified',notified_at=stamp,notification_id=notice,updated_at=stamp WHERE id=job.id;
   INSERT INTO hrm_private.attendance_push_deliveries(job_id,device_id)
    SELECT job.id,d.id FROM public.attendance_notification_devices d JOIN hrm_private.attendance_notification_keys k ON k.device_id=d.id WHERE d.user_id=job.recipient_id AND d.enabled AND d.revoked_at IS NULL AND d.last_seen_at>stamp-interval '30 days' ON CONFLICT(job_id,device_id) DO NOTHING;
  END LOOP;
  -- Expired or exhausted leases cannot loop indefinitely after worker crashes.
  stamp:=clock_timestamp();
  UPDATE hrm_private.attendance_push_deliveries d SET status=CASE WHEN j.expires_at<=stamp THEN 'suppressed' ELSE 'dead' END,error_code=CASE WHEN j.expires_at<=stamp THEN 'EXPIRED' ELSE 'ATTEMPTS_EXHAUSTED' END,lease_token=NULL,lease_until=NULL,updated_at=stamp
   FROM hrm_private.attendance_reminder_jobs j WHERE j.id=d.job_id AND d.status IN ('pending','leased','blocked_configuration') AND (d.lease_until IS NULL OR d.lease_until<=stamp) AND (j.expires_at<=stamp OR d.attempts>=5);
  FOR delivery IN SELECT * FROM hrm_private.attendance_push_deliveries WHERE status IN ('pending','leased','blocked_configuration') AND available_at<=stamp AND (lease_until IS NULL OR lease_until<=stamp) AND attempts<5 ORDER BY available_at,id LIMIT 12 FOR UPDATE SKIP LOCKED LOOP
   UPDATE hrm_private.attendance_push_deliveries SET status='leased',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=stamp+interval '3 minutes',updated_at=stamp WHERE id=delivery.id RETURNING * INTO delivery;
   items:=items||jsonb_build_array(jsonb_build_object('id',delivery.id,'leaseToken',delivery.lease_token));
  END LOOP;
  RETURN jsonb_build_object('success',true,'data',jsonb_build_object('items',items));
 ELSIF action IN ('authorize','finish') THEN
  SELECT * INTO delivery FROM hrm_private.attendance_push_deliveries WHERE id=(p_command->>'deliveryId')::uuid FOR UPDATE;
  IF NOT FOUND OR delivery.status<>'leased' OR delivery.lease_token IS DISTINCT FROM (p_command->>'leaseToken')::uuid OR delivery.lease_until<=stamp THEN RAISE EXCEPTION 'REMINDER_STALE: delivery lease is no longer current' USING ERRCODE='23514'; END IF;
  SELECT * INTO job FROM hrm_private.attendance_reminder_jobs WHERE id=delivery.job_id;
  SELECT * INTO device FROM public.attendance_notification_devices WHERE id=delivery.device_id;
  SELECT * INTO key FROM hrm_private.attendance_notification_keys WHERE device_id=device.id;
  IF action='authorize' THEN
   eligible:=hrm_private.reminder_eligibility(job);
   IF NOT (eligible->>'eligible')::boolean OR device.user_id IS DISTINCT FROM job.recipient_id OR NOT device.enabled OR device.revoked_at IS NOT NULL OR key.id IS NULL OR device.last_seen_at<=stamp-interval '30 days' THEN
    defer_until:=(eligible->>'deferUntil')::timestamptz;
    IF defer_until IS NOT NULL AND defer_until<job.expires_at AND device.user_id=job.recipient_id AND device.enabled AND device.revoked_at IS NULL THEN
     UPDATE hrm_private.attendance_push_deliveries SET status='pending',available_at=defer_until,attempts=greatest(0,attempts-1),lease_token=NULL,lease_until=NULL,error_code=eligible->>'reason',updated_at=stamp WHERE id=delivery.id;
    ELSE UPDATE hrm_private.attendance_push_deliveries SET status='suppressed',lease_token=NULL,lease_until=NULL,error_code=coalesce(eligible->>'reason','DEVICE_UNAVAILABLE'),updated_at=stamp WHERE id=delivery.id; END IF;
    RETURN jsonb_build_object('success',true,'data',jsonb_build_object('allowed',false));
   END IF;
   UPDATE hrm_private.attendance_push_deliveries SET credential_revision=key.revision WHERE id=delivery.id;
   RETURN jsonb_build_object('success',true,'data',jsonb_build_object('allowed',true,'provider',device.provider,'credential',key.credential,'expiresAt',job.expires_at,'notificationId',job.notification_id,'url',(SELECT n.link FROM public.notification_log n WHERE n.id=job.notification_id)));
  END IF;
  outcome:=p_command->>'outcome';
  IF outcome NOT IN ('sent','retry','invalid_device','permanent','blocked_configuration') OR outcome IS NULL THEN RAISE EXCEPTION 'REMINDER_INVALID: invalid delivery outcome' USING ERRCODE='22023'; END IF;
  retry_seconds:=greatest(60,least(3600,coalesce((p_command->>'retryAfter')::integer,60*(2^greatest(0,delivery.attempts-1))::integer)));
  IF outcome='invalid_device' AND key.revision IS DISTINCT FROM delivery.credential_revision THEN outcome:='retry';retry_seconds:=60; END IF;
  IF outcome='invalid_device' THEN UPDATE public.attendance_notification_devices SET enabled=false,revoked_at=stamp,updated_at=stamp WHERE id=device.id AND user_id=job.recipient_id; END IF;
  UPDATE hrm_private.attendance_push_deliveries SET status=CASE outcome WHEN 'sent' THEN 'sent' WHEN 'blocked_configuration' THEN 'blocked_configuration' WHEN 'retry' THEN CASE WHEN attempts>=5 OR stamp+make_interval(secs=>retry_seconds)>=job.expires_at THEN 'dead' ELSE 'pending' END ELSE 'dead' END,
   attempts=CASE WHEN outcome='blocked_configuration' THEN greatest(0,attempts-1) ELSE attempts END,
   available_at=stamp+make_interval(secs=>CASE WHEN outcome='blocked_configuration' THEN 900 ELSE retry_seconds END),
   sent_at=CASE WHEN outcome='sent' THEN stamp END,error_code=CASE WHEN outcome='sent' THEN NULL ELSE left(regexp_replace(coalesce(p_command->>'errorCode',outcome),'[^A-Za-z0-9_.-]','','g'),80) END,
   lease_token=NULL,lease_until=NULL,updated_at=stamp WHERE id=delivery.id;
  RETURN jsonb_build_object('success',true,'data',jsonb_build_object('recorded',true));
 ELSE RAISE EXCEPTION 'REMINDER_INVALID: unknown worker action' USING ERRCODE='22023'; END IF;
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'code',SQLSTATE,'error',CASE WHEN SQLERRM LIKE 'REMINDER_%' THEN SQLERRM ELSE 'REMINDER_INVALID: reminder worker request failed' END);
END $$;

CREATE OR REPLACE FUNCTION public.attendance_notification_user(p_command jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hrm_private.attendance_notification_user(p_command); $$;
CREATE OR REPLACE FUNCTION public.attendance_reminder_admin(p_command jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hrm_private.attendance_reminder_admin(p_command); $$;
CREATE OR REPLACE FUNCTION public.attendance_reminder_worker(p_command jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hrm_private.attendance_reminder_worker(p_command); $$;
REVOKE ALL ON FUNCTION hrm_private.reminder_due(text,timestamptz,timestamptz,public.attendance_reminder_settings),hrm_private.reminder_eligibility(hrm_private.attendance_reminder_jobs),hrm_private.attendance_notification_user(jsonb),hrm_private.attendance_reminder_admin(jsonb),hrm_private.attendance_reminder_worker(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION hrm_private.attendance_notification_user(jsonb),hrm_private.attendance_reminder_admin(jsonb) TO authenticated;
GRANT USAGE ON SCHEMA hrm_private TO service_role;
GRANT EXECUTE ON FUNCTION hrm_private.attendance_reminder_worker(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.attendance_notification_user(jsonb),public.attendance_reminder_admin(jsonb),public.attendance_reminder_worker(jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.attendance_notification_user(jsonb),public.attendance_reminder_admin(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_reminder_worker(jsonb) TO service_role;
-- Reuse the existing history subscription when Supabase Realtime is installed.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime')
 AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notification_log') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_log;
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
