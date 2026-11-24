-- Dynamic QR display infrastructure. Does not enable employee QR attendance.
BEGIN;
DO $$ BEGIN IF to_regprocedure('public.attendance_transition(jsonb,uuid,text)') IS NULL THEN RAISE EXCEPTION 'Apply attendance migration 006 first'; END IF; END $$;
CREATE TABLE IF NOT EXISTS public.attendance_stations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), store_id uuid NOT NULL REFERENCES public.stores(id), name text NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 80),
 active boolean NOT NULL DEFAULT true,
 refresh_seconds integer NOT NULL DEFAULT 30 CHECK(refresh_seconds BETWEEN 15 AND 120),
 validity_seconds integer NOT NULL DEFAULT 45 CHECK(validity_seconds BETWEEN 20 AND 180),
 heartbeat_seconds integer NOT NULL DEFAULT 15 CHECK(heartbeat_seconds BETWEEN 5 AND 60),
 offline_seconds integer NOT NULL DEFAULT 60 CHECK(offline_seconds BETWEEN 30 AND 600),
 credential_days integer NOT NULL DEFAULT 90 CHECK(credential_days BETWEEN 1 AND 365),
 issued_count bigint NOT NULL DEFAULT 0, last_issued_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by uuid,
 CHECK(validity_seconds>=refresh_seconds+5), CHECK(offline_seconds>=heartbeat_seconds*2)
);
CREATE TABLE IF NOT EXISTS public.attendance_station_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES public.attendance_stations(id), name text NOT NULL DEFAULT 'Pending display',
 approved_at timestamptz, approved_by uuid, pairing_expires_at timestamptz NOT NULL, credential_expires_at timestamptz NOT NULL,
 revoked_at timestamptz, revoked_by uuid, last_seen_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by uuid
);
CREATE TABLE IF NOT EXISTS hrm_private.attendance_station_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id uuid NOT NULL UNIQUE REFERENCES public.attendance_station_devices(id),
 credential_hash text NOT NULL UNIQUE CHECK(credential_hash ~ '^[a-f0-9]{64}$'), pairing_hash text,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by uuid
);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_station_pairing_hash ON hrm_private.attendance_station_keys(pairing_hash) WHERE pairing_hash IS NOT NULL;
CREATE TABLE IF NOT EXISTS hrm_private.attendance_station_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), station_id uuid NOT NULL REFERENCES public.attendance_stations(id), device_id uuid NOT NULL REFERENCES public.attendance_station_devices(id),
 store_id uuid NOT NULL REFERENCES public.stores(id), request_id uuid NOT NULL, purpose text NOT NULL DEFAULT 'attendance' CHECK(purpose='attendance'),
 token_hash text NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'), expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(), created_by uuid,
 UNIQUE(device_id,request_id)
);
CREATE INDEX IF NOT EXISTS attendance_station_device_lookup ON public.attendance_station_devices(station_id,revoked_at);
CREATE INDEX IF NOT EXISTS attendance_station_token_expiry ON hrm_private.attendance_station_tokens(device_id,expires_at);
ALTER TABLE public.attendance_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_station_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrm_private.attendance_station_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE hrm_private.attendance_station_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attendance_stations,public.attendance_station_devices FROM PUBLIC,anon,authenticated;
REVOKE ALL ON hrm_private.attendance_station_keys,hrm_private.attendance_station_tokens FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.attendance_stations,public.attendance_station_devices TO authenticated;
DROP POLICY IF EXISTS station_admin_read ON public.attendance_stations;
CREATE POLICY station_admin_read ON public.attendance_stations FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'));
DROP POLICY IF EXISTS station_device_admin_read ON public.attendance_station_devices;
CREATE POLICY station_device_admin_read ON public.attendance_station_devices FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.role='admin'));
ALTER TABLE public.attendance_audit_events ADD COLUMN IF NOT EXISTS station_id uuid;

CREATE OR REPLACE FUNCTION hrm_private.station_admin(p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); s public.attendance_stations; d public.attendance_station_devices; settings jsonb; action text:=p_command->>'action'; stamp timestamptz:=clock_timestamp();
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=actor AND role='admin') THEN RAISE EXCEPTION 'STATION_FORBIDDEN: administrator access required' USING ERRCODE='42501'; END IF;
 IF pg_column_size(p_command)>8192 THEN RAISE EXCEPTION 'STATION_INVALID: station command is too large' USING ERRCODE='22023'; END IF;
 IF action='list' THEN RETURN jsonb_build_object('success',true,'data',jsonb_build_object(
  'stations',coalesce((SELECT jsonb_agg(to_jsonb(st) ORDER BY st.created_at DESC) FROM public.attendance_stations st),'[]'::jsonb),
  'devices',coalesce((SELECT jsonb_agg(to_jsonb(dev) ORDER BY dev.created_at DESC) FROM public.attendance_station_devices dev),'[]'::jsonb),
  'stores',coalesce((SELECT jsonb_agg(jsonb_build_object('id',st.id,'name',st.name) ORDER BY st.name) FROM public.stores st),'[]'::jsonb),'serverNow',stamp)); END IF;
 IF action='create' THEN
  settings:=p_command->'settings';
  INSERT INTO public.attendance_stations(store_id,name,refresh_seconds,validity_seconds,heartbeat_seconds,offline_seconds,credential_days,created_by)
  VALUES((settings->>'store_id')::uuid,btrim(settings->>'name'),(settings->>'refresh_seconds')::integer,(settings->>'validity_seconds')::integer,(settings->>'heartbeat_seconds')::integer,(settings->>'offline_seconds')::integer,(settings->>'credential_days')::integer,actor) RETURNING * INTO s;
 ELSE
  SELECT * INTO s FROM public.attendance_stations WHERE id=(p_command->>'stationId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'STATION_NOT_FOUND: attendance station not found' USING ERRCODE='22023'; END IF;
  stamp:=clock_timestamp();
  IF action='update' THEN
   IF (p_command->>'expectedUpdatedAt')::timestamptz IS DISTINCT FROM s.updated_at THEN RAISE EXCEPTION 'STATION_STALE: station settings changed; refresh before saving' USING ERRCODE='23514'; END IF;
   settings:=p_command->'settings';
   IF s.store_id IS DISTINCT FROM (settings->>'store_id')::uuid OR NOT coalesce((p_command->>'active')::boolean,false) THEN
    UPDATE public.attendance_station_devices SET revoked_at=coalesce(revoked_at,stamp),revoked_by=coalesce(revoked_by,actor),updated_at=stamp WHERE station_id=s.id AND revoked_at IS NULL;
    UPDATE hrm_private.attendance_station_keys k SET pairing_hash=NULL WHERE device_id IN(SELECT id FROM public.attendance_station_devices WHERE station_id=s.id);
   END IF;
   UPDATE public.attendance_stations SET store_id=(settings->>'store_id')::uuid,name=btrim(settings->>'name'),active=(p_command->>'active')::boolean,
    refresh_seconds=(settings->>'refresh_seconds')::integer,validity_seconds=(settings->>'validity_seconds')::integer,heartbeat_seconds=(settings->>'heartbeat_seconds')::integer,
    offline_seconds=(settings->>'offline_seconds')::integer,credential_days=(settings->>'credential_days')::integer,updated_at=stamp WHERE id=s.id RETURNING * INTO s;
  ELSIF action='pair' THEN
   IF NOT s.active THEN RAISE EXCEPTION 'STATION_INACTIVE: activate this station before pairing' USING ERRCODE='23514'; END IF;
   IF coalesce(p_command->>'code','') !~ '^[0-9A-HJKMNP-TV-Z]{8}$' OR length(btrim(coalesce(p_command->>'deviceName','')) ) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'STATION_INVALID: valid pairing code and display name required' USING ERRCODE='22023'; END IF;
   SELECT dev.* INTO d FROM public.attendance_station_devices dev JOIN hrm_private.attendance_station_keys k ON k.device_id=dev.id
    WHERE dev.station_id=s.id AND k.pairing_hash=encode(sha256(convert_to(p_command->>'code','UTF8')),'hex') FOR UPDATE OF dev;
   IF NOT FOUND OR d.approved_at IS NOT NULL OR d.revoked_at IS NOT NULL OR d.pairing_expires_at<=stamp THEN RAISE EXCEPTION 'STATION_PAIR_EXPIRED: code is invalid, used or expired' USING ERRCODE='23514'; END IF;
   UPDATE public.attendance_station_devices SET approved_at=stamp,approved_by=actor,name=btrim(p_command->>'deviceName'),credential_expires_at=stamp+make_interval(days=>s.credential_days),updated_at=stamp WHERE id=d.id RETURNING * INTO d;
   UPDATE hrm_private.attendance_station_keys SET pairing_hash=NULL,updated_at=stamp WHERE device_id=d.id;
  ELSIF action='revoke' THEN
   UPDATE public.attendance_station_devices SET revoked_at=coalesce(revoked_at,stamp),revoked_by=coalesce(revoked_by,actor),updated_at=stamp WHERE id=(p_command->>'deviceId')::uuid AND station_id=s.id RETURNING * INTO d;
   IF NOT FOUND THEN RAISE EXCEPTION 'STATION_NOT_FOUND: display not found' USING ERRCODE='22023'; END IF;
   UPDATE hrm_private.attendance_station_keys SET pairing_hash=NULL,updated_at=stamp WHERE device_id=d.id;
  ELSE RAISE EXCEPTION 'STATION_INVALID: unsupported station action' USING ERRCODE='22023'; END IF;
 END IF;
 INSERT INTO public.attendance_audit_events(store_id,station_id,event_type,attendance_method,entry_point,new_values,created_by)
 VALUES(s.store_id,s.id,'station_'||action,'station','admin_console',CASE WHEN d.id IS NOT NULL THEN to_jsonb(d) ELSE to_jsonb(s) END,actor);
 RETURN jsonb_build_object('success',true,'data',to_jsonb(s));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'code',SQLSTATE,'error',CASE WHEN SQLERRM LIKE 'STATION_%' THEN SQLERRM ELSE 'STATION_INVALID: could not save station settings' END);
END $$;

CREATE OR REPLACE FUNCTION hrm_private.station_device(p_action text,p_credential text,p_station_id uuid,p_request_id uuid,p_token_hash text,p_pairing_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.attendance_stations; d public.attendance_station_devices; t hrm_private.attendance_station_tokens; stamp timestamptz:=clock_timestamp(); credential_digest text; data jsonb; pending integer;
BEGIN
 IF p_credential IS NULL OR p_credential !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'STATION_UNAUTHORIZED: pair this display to continue' USING ERRCODE='42501'; END IF;
 credential_digest:=encode(sha256(convert_to(p_credential,'UTF8')),'hex');
 -- Always lock the station before the device, matching admin revocation order.
 SELECT st.* INTO s FROM public.attendance_stations st WHERE st.id=coalesce(p_station_id,(SELECT dev.station_id FROM public.attendance_station_devices dev JOIN hrm_private.attendance_station_keys k ON k.device_id=dev.id WHERE k.credential_hash=credential_digest)) FOR UPDATE;
 IF NOT FOUND OR (NOT s.active AND p_action<>'forget') THEN RAISE EXCEPTION 'STATION_INACTIVE: this station is unavailable' USING ERRCODE='42501'; END IF;
 stamp:=clock_timestamp();
 SELECT dev.* INTO d FROM public.attendance_station_devices dev JOIN hrm_private.attendance_station_keys k ON k.device_id=dev.id WHERE k.credential_hash=credential_digest FOR UPDATE OF dev;
 IF FOUND AND d.station_id<>s.id THEN RAISE EXCEPTION 'STATION_WRONG_DISPLAY: this browser is paired to another station' USING ERRCODE='42501'; END IF;
 IF p_action='start' AND d.id IS NULL THEN
  IF p_pairing_hash IS NULL OR p_pairing_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'STATION_INVALID: invalid pairing request' USING ERRCODE='22023'; END IF;
  UPDATE public.attendance_station_devices SET revoked_at=stamp,updated_at=stamp WHERE station_id=s.id AND approved_at IS NULL AND revoked_at IS NULL AND pairing_expires_at<=stamp;
  UPDATE hrm_private.attendance_station_keys SET pairing_hash=NULL WHERE device_id IN(SELECT id FROM public.attendance_station_devices WHERE station_id=s.id AND revoked_at IS NOT NULL);
  SELECT count(*) INTO pending FROM public.attendance_station_devices WHERE station_id=s.id AND approved_at IS NULL AND revoked_at IS NULL;
  IF pending>=5 THEN RETURN jsonb_build_object('success',false,'code','RATE_LIMITED','error','Too many pending display requests. Ask an administrator to clear them.','retryAfter',300); END IF;
  INSERT INTO public.attendance_station_devices(station_id,pairing_expires_at,credential_expires_at,created_by) VALUES(s.id,stamp+interval '5 minutes',stamp+interval '5 minutes',auth.uid()) RETURNING * INTO d;
  INSERT INTO hrm_private.attendance_station_keys(device_id,credential_hash,pairing_hash,created_by) VALUES(d.id,credential_digest,p_pairing_hash,auth.uid());
  INSERT INTO public.attendance_audit_events(store_id,station_id,event_type,attendance_method,entry_point,new_values,created_by) VALUES(s.store_id,s.id,'station_pair_requested','station','station_display',jsonb_build_object('device_id',d.id),auth.uid());
 ELSIF d.id IS NULL THEN RAISE EXCEPTION 'STATION_UNAUTHORIZED: pair this display to continue' USING ERRCODE='42501'; END IF;
 IF d.revoked_at IS NOT NULL AND p_action<>'forget' THEN RAISE EXCEPTION 'STATION_REVOKED: this display authorization was revoked' USING ERRCODE='42501'; END IF;
 IF d.credential_expires_at<=stamp AND p_action<>'forget' THEN RAISE EXCEPTION 'STATION_EXPIRED: pair this display again' USING ERRCODE='42501'; END IF;
 IF p_action='forget' THEN
  UPDATE public.attendance_station_devices SET revoked_at=stamp,updated_at=stamp WHERE id=d.id;
  UPDATE hrm_private.attendance_station_keys SET pairing_hash=NULL WHERE device_id=d.id;
  INSERT INTO public.attendance_audit_events(store_id,station_id,event_type,attendance_method,entry_point,new_values) VALUES(s.store_id,s.id,'station_unpaired','station','station_display',jsonb_build_object('device_id',d.id));
  RETURN jsonb_build_object('success',true,'data',jsonb_build_object('state','unpaired'));
 END IF;
 IF p_action NOT IN ('start','status','heartbeat','issue') THEN RAISE EXCEPTION 'STATION_INVALID: unsupported display action' USING ERRCODE='22023'; END IF;
 IF d.approved_at IS NULL AND p_action='issue' THEN RAISE EXCEPTION 'STATION_UNAUTHORIZED: administrator authorization is required' USING ERRCODE='42501'; END IF;
 IF d.approved_at IS NOT NULL AND (d.last_seen_at IS NULL OR d.last_seen_at<stamp-interval '5 seconds') THEN
  UPDATE public.attendance_station_devices SET last_seen_at=stamp,updated_at=stamp WHERE id=d.id RETURNING * INTO d;
 END IF;
 data:=jsonb_build_object('state',CASE WHEN d.approved_at IS NULL THEN 'pending' ELSE 'authorized' END,'device',to_jsonb(d)-'created_by'-'approved_by'-'revoked_by','station',to_jsonb(s)-'created_by','branchName',(SELECT name FROM public.stores WHERE id=s.store_id),'serverNow',stamp,
  'scanEnabled',coalesce((SELECT smart_qr_enabled FROM public.attendance_policies WHERE store_id=s.store_id),false));
 IF d.approved_at IS NOT NULL AND p_action IN ('status','heartbeat') THEN
  SELECT * INTO t FROM hrm_private.attendance_station_tokens WHERE device_id=d.id AND expires_at>stamp ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN data:=data||jsonb_build_object('tokenId',t.id,'requestId',t.request_id,'expiresAt',t.expires_at); END IF;
 END IF;
 IF p_action='issue' THEN
  IF p_request_id IS NULL OR p_token_hash IS NULL OR p_token_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'STATION_INVALID: invalid QR request' USING ERRCODE='22023'; END IF;
  SELECT * INTO t FROM hrm_private.attendance_station_tokens WHERE device_id=d.id AND request_id=p_request_id;
  IF FOUND THEN
   IF t.token_hash<>p_token_hash OR t.expires_at<=stamp THEN RAISE EXCEPTION 'STATION_TOKEN_EXPIRED: request a fresh QR code' USING ERRCODE='23514'; END IF;
  ELSE
   IF s.last_issued_at IS NOT NULL AND EXISTS(SELECT 1 FROM hrm_private.attendance_station_tokens WHERE device_id=d.id AND created_at>stamp-make_interval(secs=>s.refresh_seconds)) THEN
    RETURN jsonb_build_object('success',false,'code','RATE_LIMITED','error','The next QR refresh is not due yet.','retryAfter',greatest(1,ceil(extract(epoch FROM (
     (SELECT max(created_at) FROM hrm_private.attendance_station_tokens WHERE device_id=d.id)+make_interval(secs=>s.refresh_seconds)-stamp)))::integer));
   END IF;
   INSERT INTO hrm_private.attendance_station_tokens(station_id,device_id,store_id,request_id,token_hash,expires_at,created_by)
    VALUES(s.id,d.id,s.store_id,p_request_id,p_token_hash,stamp+make_interval(secs=>s.validity_seconds),auth.uid()) RETURNING * INTO t;
   UPDATE public.attendance_stations SET issued_count=issued_count+1,last_issued_at=stamp WHERE id=s.id;
   -- Expired code material is not attendance history; retain aggregate counters.
   DELETE FROM hrm_private.attendance_station_tokens WHERE device_id=d.id AND expires_at<stamp-interval '24 hours';
  END IF;
  data:=data||jsonb_build_object('tokenId',t.id,'requestId',t.request_id,'expiresAt',t.expires_at);
 END IF;
 RETURN jsonb_build_object('success',true,'data',data);
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'code',SQLSTATE,'error',CASE WHEN SQLERRM LIKE 'STATION_%' THEN SQLERRM ELSE 'STATION_INVALID: display request could not be processed' END);
END $$;

-- Read-only capability verification, NOT token redemption or an attendance action.
CREATE OR REPLACE FUNCTION hrm_private.station_token_status(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t hrm_private.attendance_station_tokens; parts text[]; employee public.profiles; stamp timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO employee FROM public.profiles WHERE id=auth.uid();
 IF employee.id IS NULL THEN RAISE EXCEPTION 'STATION_UNAUTHORIZED: sign in to verify a code' USING ERRCODE='42501'; END IF;
 IF p_token IS NULL OR length(p_token)>160 OR p_token !~ '^hrm\.attendance\.v1\.[a-f0-9-]{36}\.[A-Za-z0-9_-]{43}$' THEN RAISE EXCEPTION 'STATION_TOKEN_INVALID: invalid attendance code' USING ERRCODE='22023'; END IF;
 parts:=string_to_array(p_token,'.');
 SELECT * INTO t FROM hrm_private.attendance_station_tokens WHERE id=parts[4]::uuid AND token_hash=encode(sha256(convert_to(parts[5],'UTF8')),'hex') AND purpose='attendance';
 IF NOT FOUND OR t.expires_at<=stamp THEN RAISE EXCEPTION 'STATION_TOKEN_EXPIRED: scan a fresh code' USING ERRCODE='23514'; END IF;
 IF employee.store_id IS DISTINCT FROM t.store_id THEN RAISE EXCEPTION 'STATION_WRONG_BRANCH: use your assigned branch' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.attendance_stations s JOIN public.attendance_station_devices d ON d.station_id=s.id WHERE s.id=t.station_id AND s.active AND s.store_id=t.store_id AND d.id=t.device_id AND d.approved_at IS NOT NULL AND d.revoked_at IS NULL AND d.credential_expires_at>stamp) THEN
  RAISE EXCEPTION 'STATION_REVOKED: this code is no longer authorized' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('success',true,'data',jsonb_build_object('tokenId',t.id,'stationId',t.station_id,'storeId',t.store_id,'expiresAt',t.expires_at));
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('success',false,'code',SQLSTATE,'error',CASE WHEN SQLERRM LIKE 'STATION_%' THEN SQLERRM ELSE 'STATION_TOKEN_INVALID: invalid attendance code' END);
END $$;

CREATE OR REPLACE FUNCTION public.attendance_station_admin(p_command jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hrm_private.station_admin(p_command); $$;
-- Anonymous display capability: explicit grant, constrained by a 256-bit credential.
-- Definer wrapper avoids granting anonymous schema access to hrm_private.
CREATE OR REPLACE FUNCTION public.attendance_station_device(p_action text,p_credential text,p_station_id uuid,p_request_id uuid DEFAULT NULL,p_token_hash text DEFAULT NULL,p_pairing_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$ SELECT hrm_private.station_device(p_action,p_credential,p_station_id,p_request_id,p_token_hash,p_pairing_hash); $$;
CREATE OR REPLACE FUNCTION public.attendance_station_token_status(p_token text) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT hrm_private.station_token_status(p_token); $$;
REVOKE ALL ON FUNCTION hrm_private.station_admin(jsonb),hrm_private.station_device(text,text,uuid,uuid,text,text),hrm_private.station_token_status(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hrm_private.station_admin(jsonb),hrm_private.station_token_status(text) TO authenticated;
REVOKE ALL ON FUNCTION public.attendance_station_admin(jsonb),public.attendance_station_device(text,text,uuid,uuid,text,text),public.attendance_station_token_status(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_station_admin(jsonb),public.attendance_station_token_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.attendance_station_device(text,text,uuid,uuid,text,text) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
