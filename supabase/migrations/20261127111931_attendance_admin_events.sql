BEGIN;
-- Only committed engine transitions produce alerts. No historical backfill.
CREATE OR REPLACE FUNCTION hrm_private.notify_admin_attendance_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE session public.attendance; employee public.profiles; recipient uuid; branch text; verb text; happened timestamptz;
BEGIN
 IF NEW.action NOT IN ('clock_in','clock_out') OR NEW.response->>'success' IS DISTINCT FROM 'true'
    OR NEW.response->>'changed' IS DISTINCT FROM 'true' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.response IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO employee FROM public.profiles WHERE id=NEW.employee_id AND role='employee';
 IF employee.id IS NULL OR NEW.created_by IS DISTINCT FROM employee.id THEN RETURN NEW; END IF;
 SELECT * INTO session FROM public.attendance WHERE id=(NEW.response->'data'->>'id')::uuid AND employee_id=employee.id;
 IF session.id IS NULL THEN RETURN NEW; END IF;
 INSERT INTO store_ops_private.alert_keys(key,created_by) VALUES('attendance-operation:'||NEW.id,employee.id) ON CONFLICT(key) DO NOTHING;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT name INTO branch FROM public.stores WHERE id=session.store_id;
 verb:=CASE NEW.action WHEN 'clock_in' THEN 'checked in' ELSE 'checked out' END;
 happened:=CASE NEW.action WHEN 'clock_in' THEN session.check_in ELSE session.check_out END;
 FOR recipient IN SELECT id FROM public.profiles WHERE role='admin' AND (store_id IS NULL OR store_id=session.store_id) LOOP
  PERFORM store_ops_private.notify(recipient,session.store_id,
   CASE NEW.action WHEN 'clock_in' THEN 'Employee checked in' ELSE 'Employee checked out' END,
   coalesce(nullif(employee.full_name,''),'Employee')||' '||verb||' at '||coalesce(branch,'their store')||' · '||to_char(happened AT TIME ZONE 'Asia/Kolkata','DD Mon YYYY, HH24:MI')||' IST',
   'attendance_'||NEW.action,'/admin/logs',employee.id);
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION hrm_private.notify_admin_attendance_event() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER attendance_admin_event AFTER INSERT OR UPDATE OF response ON public.attendance_operations
 FOR EACH ROW EXECUTE FUNCTION hrm_private.notify_admin_attendance_event();

-- Reuse the existing queue, leases, retries and explicit device opt-in.
-- Recheck current admin authority immediately before delivering these alerts.
CREATE OR REPLACE FUNCTION public.store_ops_worker(p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE action text:=p_command->>'action'; stamp timestamptz:=clock_timestamp(); today date:=(stamp AT TIME ZONE 'Asia/Kolkata')::date;
 settings public.store_operations_settings; tester public.testers; payload jsonb; item store_ops_private.push_deliveries; outcome text; created integer:=0;
BEGIN
 IF auth.uid() IS NOT NULL OR current_setting('role',true) NOT IN ('none','service_role') THEN RAISE EXCEPTION 'Worker access required' USING ERRCODE='42501'; END IF;
 IF action='plan' THEN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('store_operations_planner',0)) THEN RETURN jsonb_build_object('busy',true); END IF;
  FOR settings IN SELECT * FROM public.store_operations_settings WHERE enabled LOOP
   IF (stamp AT TIME ZONE 'Asia/Kolkata')::time>=settings.opening_due AND NOT EXISTS(SELECT 1 FROM public.daily_checklists WHERE store_id=settings.store_id AND type='opening' AND date=today AND status='completed' AND superseded_at IS NULL) THEN
    PERFORM store_ops_private.alert_once(settings.store_id,'checklist_pending',settings.store_id||':opening:'||today,'Opening checklist pending','The opening checklist has not been completed.','/admin/store-operations/daily-checklist',settings.created_by);
   END IF;
   IF (stamp AT TIME ZONE 'Asia/Kolkata')::time>=settings.closing_due AND NOT EXISTS(SELECT 1 FROM public.daily_checklists WHERE store_id=settings.store_id AND type='closing' AND date=today AND status='completed' AND superseded_at IS NULL) THEN
    PERFORM store_ops_private.alert_once(settings.store_id,'store_closed_late',settings.store_id||':closing:'||today,'Closing checklist overdue','Confirm the store is closed and complete the closing checklist.','/admin/store-operations/daily-checklist',settings.created_by);
   END IF;
   IF (stamp AT TIME ZONE 'Asia/Kolkata')::time>=settings.opening_due AND NOT EXISTS(SELECT 1 FROM public.shelf_inspections WHERE store_id=settings.store_id AND created_at>=today::timestamp AT TIME ZONE 'Asia/Kolkata') THEN
    PERFORM store_ops_private.alert_once(settings.store_id,'inspection_pending',settings.store_id||':inspection:'||today,'Shelf inspection pending','No shelf inspection has been submitted today.','/admin/store-operations/shelf-inspection',settings.created_by);
   END IF;
   IF NOT EXISTS(SELECT 1 FROM public.audits WHERE store_id=settings.store_id AND status='completed' AND created_at>stamp-make_interval(days=>settings.audit_due_days)) THEN
    PERFORM store_ops_private.alert_once(settings.store_id,'audit_due',settings.store_id||':audit:'||today,'Store audit due','No completed audit was recorded within the configured interval.','/admin/store-operations/audits',settings.created_by);
   END IF;
   FOR tester IN SELECT * FROM public.testers WHERE store_id=settings.store_id AND (expiry_date<=today+settings.tester_notice_days OR needs_replacement) LOOP
    PERFORM store_ops_private.alert_once(settings.store_id,CASE WHEN tester.expiry_date<today THEN 'tester_expired' WHEN tester.needs_replacement THEN 'tester_replacement' ELSE 'tester_expiring' END,
     tester.id||':'||coalesce(tester.expiry_date::text,'replacement')||':'||CASE WHEN tester.expiry_date<today THEN 'expired' WHEN tester.needs_replacement THEN 'replace' ELSE 'upcoming' END,
     CASE WHEN tester.expiry_date<today THEN 'Tester expired' WHEN tester.needs_replacement THEN 'Tester needs replacement' ELSE 'Tester expiring soon' END,
     tester.product_name,'/admin/store-operations/testers/'||tester.id,settings.created_by);
   END LOOP;
  END LOOP;
  SELECT count(*) INTO created FROM public.notification_log WHERE created_at>=stamp AND type LIKE 'ops_%';
  RETURN jsonb_build_object('planned',created);
 ELSIF action='claim' THEN
  UPDATE store_ops_private.push_deliveries d SET state='expired',updated_at=stamp FROM public.notification_log n WHERE n.id=d.notification_id AND d.state IN ('pending','leased') AND (n.created_at<stamp-interval '24 hours' OR d.attempts>=5);
  WITH picked AS(SELECT id FROM store_ops_private.push_deliveries WHERE (state='pending' AND available_at<=stamp) OR (state='leased' AND lease_until<stamp) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 12),
  leased AS(UPDATE store_ops_private.push_deliveries d SET state='leased',attempts=attempts+1,lease_token=gen_random_uuid(),lease_until=stamp+interval '2 minutes',updated_at=stamp FROM picked WHERE d.id=picked.id RETURNING d.id,d.lease_token)
  SELECT jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object('id',id,'leaseToken',lease_token)),'[]'::jsonb)) INTO payload FROM leased;
  RETURN payload;
 ELSIF action='authorize' THEN
  SELECT jsonb_build_object('allowed',true,'provider','fcm','category',CASE WHEN n.type IN ('ops_attendance_clock_in','ops_attendance_clock_out') THEN 'attendance_event' ELSE 'operations' END,'credential',k.credential,'notificationId',n.id,'url',n.link,'expiresAt',n.created_at+interval '24 hours') INTO payload
   FROM store_ops_private.push_deliveries d JOIN public.notification_log n ON n.id=d.notification_id
   JOIN public.attendance_notification_devices device ON device.id=d.device_id AND device.user_id=n.user_id AND device.enabled AND device.revoked_at IS NULL
   JOIN hrm_private.attendance_notification_keys k ON k.device_id=device.id
   JOIN public.store_operation_preferences preference ON preference.user_id=n.user_id AND preference.enabled AND preference.push_enabled
   JOIN public.profiles profile ON profile.id=n.user_id AND (profile.role='admin' OR profile.store_id=n.operations_store_id)
   WHERE d.id=(p_command->>'deliveryId')::uuid AND d.state='leased' AND d.lease_token=(p_command->>'leaseToken')::uuid AND d.lease_until>stamp AND n.created_at>stamp-interval '24 hours'
   AND (n.type NOT IN ('ops_attendance_clock_in','ops_attendance_clock_out') OR (profile.role='admin' AND (profile.store_id IS NULL OR profile.store_id=n.operations_store_id)));
  IF payload IS NULL THEN UPDATE store_ops_private.push_deliveries SET state='suppressed',updated_at=stamp WHERE id=(p_command->>'deliveryId')::uuid AND lease_token=(p_command->>'leaseToken')::uuid; END IF;
  RETURN coalesce(payload,jsonb_build_object('allowed',false));
 ELSIF action='finish' THEN
  SELECT * INTO item FROM store_ops_private.push_deliveries WHERE id=(p_command->>'deliveryId')::uuid AND state='leased' AND lease_token=(p_command->>'leaseToken')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Delivery lease expired'; END IF;
  outcome:=p_command->>'outcome';
  IF outcome NOT IN ('sent','retry','invalid_device','permanent','blocked_configuration') THEN RAISE EXCEPTION 'Invalid delivery outcome'; END IF;
  UPDATE store_ops_private.push_deliveries SET state=CASE WHEN outcome='sent' THEN 'sent' WHEN outcome IN ('retry','blocked_configuration') AND attempts<5 THEN 'pending' ELSE 'failed' END,
   available_at=stamp+make_interval(secs=>CASE WHEN outcome='blocked_configuration' THEN 3600 ELSE greatest(60,least(coalesce((p_command->>'retryAfter')::integer,60),3600)) END),last_error=left(p_command->>'errorCode',80),lease_token=NULL,lease_until=NULL,updated_at=stamp WHERE id=item.id;
  IF outcome='invalid_device' THEN UPDATE public.attendance_notification_devices SET enabled=false,revoked_at=stamp WHERE id=item.device_id; END IF;
  RETURN jsonb_build_object('success',true);
 END IF;
 RAISE EXCEPTION 'Unknown worker action';
END $$;
REVOKE ALL ON FUNCTION public.store_ops_worker(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.store_ops_worker(jsonb) TO service_role;

COMMIT;
