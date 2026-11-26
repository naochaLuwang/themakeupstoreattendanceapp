BEGIN;
ALTER TABLE public.tasks ADD COLUMN completed_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN completed_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.notification_log ADD COLUMN operations_store_id uuid REFERENCES public.stores(id);
CREATE TABLE public.store_operation_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid REFERENCES public.stores(id),record_type text NOT NULL,record_id uuid NOT NULL,
 action text NOT NULL,previous_values jsonb,next_values jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES public.profiles(id)
);
CREATE INDEX operation_event_store_date ON public.store_operation_events(store_id,created_at DESC);
ALTER TABLE public.store_operation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_operation_events FROM authenticated;
GRANT SELECT ON public.store_operation_events TO authenticated;
REVOKE ALL ON public.store_operation_events FROM anon;
CREATE POLICY ops_event_read ON public.store_operation_events FOR SELECT TO authenticated USING(store_ops_private.in_store(store_id) AND (store_ops_private.manager() OR created_by=auth.uid() OR (record_type='tasks' AND EXISTS(SELECT 1 FROM public.tasks WHERE id=record_id))));
CREATE TABLE public.store_operations_settings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id),enabled boolean NOT NULL DEFAULT true,
 opening_due time NOT NULL DEFAULT '10:00',closing_due time NOT NULL DEFAULT '21:00',audit_due_days integer NOT NULL DEFAULT 7 CHECK(audit_due_days BETWEEN 1 AND 365),
 tester_notice_days integer NOT NULL DEFAULT 7 CHECK(tester_notice_days BETWEEN 1 AND 90),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES public.profiles(id)
);
ALTER TABLE public.store_operations_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_operations_settings FROM authenticated;
GRANT SELECT,INSERT,UPDATE ON public.store_operations_settings TO authenticated;
CREATE POLICY ops_settings_read ON public.store_operations_settings FOR SELECT TO authenticated USING(store_ops_private.manager() AND store_ops_private.in_store(store_id));
CREATE POLICY ops_settings_insert ON public.store_operations_settings FOR INSERT TO authenticated WITH CHECK(store_ops_private.manager() AND store_ops_private.in_store(store_id) AND created_by=auth.uid());
CREATE POLICY ops_settings_update ON public.store_operations_settings FOR UPDATE TO authenticated USING(store_ops_private.manager() AND store_ops_private.in_store(store_id)) WITH CHECK(store_ops_private.manager() AND store_ops_private.in_store(store_id));
CREATE TRIGGER ops_settings_stamp BEFORE UPDATE ON public.store_operations_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ops_settings_guard BEFORE INSERT OR UPDATE ON public.store_operations_settings FOR EACH ROW EXECUTE FUNCTION store_ops_private.guard_record();
CREATE TABLE public.store_operation_preferences(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),enabled boolean NOT NULL DEFAULT true,push_enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES public.profiles(id)
);
ALTER TABLE public.store_operation_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_operation_preferences FROM authenticated;
GRANT SELECT,INSERT,UPDATE ON public.store_operation_preferences TO authenticated;
CREATE POLICY ops_preference_read ON public.store_operation_preferences FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY ops_preference_insert ON public.store_operation_preferences FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND created_by=auth.uid());
CREATE POLICY ops_preference_update ON public.store_operation_preferences FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid() AND created_by=auth.uid());
CREATE TRIGGER ops_preference_stamp BEFORE UPDATE ON public.store_operation_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER ops_preference_guard BEFORE INSERT OR UPDATE ON public.store_operation_preferences FOR EACH ROW EXECUTE FUNCTION store_ops_private.guard_child('user_id');
CREATE TABLE store_ops_private.push_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),notification_id uuid NOT NULL REFERENCES public.notification_log(id) ON DELETE CASCADE,device_id uuid NOT NULL REFERENCES public.attendance_notification_devices(id),
 state text NOT NULL DEFAULT 'pending',attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),lease_token uuid,lease_until timestamptz,
 last_error text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES public.profiles(id),UNIQUE(notification_id,device_id)
);
CREATE TABLE store_ops_private.alert_keys(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key text NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES public.profiles(id));
REVOKE ALL ON ALL TABLES IN SCHEMA store_ops_private FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION store_ops_private.task_completion_stamp() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.status='completed' AND OLD.status<>'completed' THEN NEW.completed_at:=clock_timestamp();NEW.completed_by:=auth.uid();
  ELSIF NEW.status<>'completed' THEN NEW.completed_at:=NULL;NEW.completed_by:=NULL;
  ELSE NEW.completed_at:=OLD.completed_at;NEW.completed_by:=OLD.completed_by;END IF;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION store_ops_private.task_completion_stamp() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ops_task_completion_stamp BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION store_ops_private.task_completion_stamp();

CREATE OR REPLACE FUNCTION store_ops_private.notify(recipient uuid,store uuid,title text,body text,kind text,link text,author uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF recipient IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=recipient AND (role='admin' OR store_id=store)) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.store_operation_preferences WHERE user_id=recipient AND NOT enabled) THEN RETURN; END IF;
 INSERT INTO public.notification_log(user_id,title,body,type,link,created_by,operations_store_id) VALUES(recipient,left(title,150),left(body,500),'ops_'||kind,link,author,store);
END $$;
CREATE OR REPLACE FUNCTION store_ops_private.notify_managers(store uuid,title text,body text,kind text,link text,author uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ DECLARE recipient uuid; BEGIN
 FOR recipient IN SELECT id FROM public.profiles WHERE role='admin' OR (role='manager' AND store_id=store) LOOP
  PERFORM store_ops_private.notify(recipient,store,title,body,kind,link,author);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION store_ops_private.operation_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row_data jsonb; old_data jsonb; store uuid; author uuid; path text;
BEGIN
 row_data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 old_data:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END;
 IF TG_OP='UPDATE' AND row_data-'updated_at'=old_data-'updated_at' THEN RETURN NEW; END IF;
 store:=(row_data->>'store_id')::uuid;author:=coalesce(auth.uid(),(row_data->>'created_by')::uuid);
 INSERT INTO public.store_operation_events(store_id,record_type,record_id,action,previous_values,next_values,created_by)
 VALUES(store,TG_TABLE_NAME,(row_data->>'id')::uuid,lower(TG_OP),old_data,CASE WHEN TG_OP='DELETE' THEN NULL ELSE row_data END,author);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 path:=CASE TG_TABLE_NAME WHEN 'shelf_inspections' THEN 'shelf-inspection' WHEN 'damage_reports' THEN 'damage-reports' WHEN 'restock_requests' THEN 'restocking' ELSE replace(TG_TABLE_NAME,'_','-') END;
 IF TG_TABLE_NAME='tasks' THEN
  IF TG_OP='INSERT' OR row_data->>'assigned_to' IS DISTINCT FROM old_data->>'assigned_to' THEN
   PERFORM store_ops_private.notify((row_data->>'assigned_to')::uuid,store,'Task assigned',row_data->>'title','task_assigned','/employee/store-operations/tasks/'||(row_data->>'id'),author);
  ELSIF row_data->>'status'='completed' AND old_data->>'status'<>'completed' THEN
   PERFORM store_ops_private.notify_managers(store,'Task completed',row_data->>'title','task_completed','/admin/store-operations/tasks/'||(row_data->>'id'),author);
  END IF;
 ELSIF TG_TABLE_NAME='damage_reports' AND row_data->>'status'='approved' AND old_data->>'status' IS DISTINCT FROM 'approved' THEN
  PERFORM store_ops_private.notify((row_data->>'created_by')::uuid,store,'Damage report approved',row_data->>'product_name','damage_approved','/employee/store-operations/damage-reports/'||(row_data->>'id'),author);
 ELSIF TG_OP='INSERT' AND TG_TABLE_NAME IN ('shelf_inspections','damage_reports','incidents','restock_requests') THEN
  PERFORM store_ops_private.notify_managers(store,CASE TG_TABLE_NAME WHEN 'shelf_inspections' THEN 'Inspection awaiting review' WHEN 'damage_reports' THEN 'Damage report awaiting review' WHEN 'incidents' THEN 'Incident reported' ELSE 'Restock requested' END,
   coalesce(row_data->>'title',row_data->>'product_name','Open Store Operations to review.'),'pending_'||TG_TABLE_NAME,'/admin/store-operations/'||path||'/'||(row_data->>'id'),author);
 END IF;
 IF TG_TABLE_NAME='shelf_inspections' AND row_data->>'status'='needs_restock' AND (TG_OP='INSERT' OR old_data->>'status' IS DISTINCT FROM 'needs_restock') THEN
  PERFORM store_ops_private.notify_managers(store,'Shelf needs restocking',coalesce(row_data->>'notes','Review the shelf inspection.'),'low_stock','/admin/store-operations/shelf-inspection/'||(row_data->>'id'),author);
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['shelf_inspections','damage_reports','testers','tasks','audits','daily_checklists','incidents','restock_requests'] LOOP
  EXECUTE format('CREATE TRIGGER ops_event AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION store_ops_private.operation_event()',tbl);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION store_ops_private.enqueue_push() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NEW.type LIKE 'ops_%' AND EXISTS(SELECT 1 FROM public.store_operation_preferences WHERE user_id=NEW.user_id AND enabled AND push_enabled) THEN
  INSERT INTO store_ops_private.push_deliveries(notification_id,device_id,created_by)
   SELECT NEW.id,d.id,NEW.user_id FROM public.attendance_notification_devices d
   WHERE d.user_id=NEW.user_id AND d.provider='fcm' AND d.enabled AND d.revoked_at IS NULL AND d.last_seen_at>now()-interval '30 days';
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER ops_enqueue_push AFTER INSERT ON public.notification_log FOR EACH ROW EXECUTE FUNCTION store_ops_private.enqueue_push();
REVOKE ALL ON FUNCTION store_ops_private.notify(uuid,uuid,text,text,text,text,uuid),store_ops_private.notify_managers(uuid,text,text,text,text,uuid),store_ops_private.operation_event(),store_ops_private.enqueue_push() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION store_ops_private.alert_once(store uuid,kind text,key text,title text,body text,path text,author uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 INSERT INTO store_ops_private.alert_keys(key,created_by) VALUES(key,author) ON CONFLICT DO NOTHING;
 IF FOUND THEN PERFORM store_ops_private.notify_managers(store,title,body,kind,path,author); END IF;
END $$;
REVOKE ALL ON FUNCTION store_ops_private.alert_once(uuid,text,text,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
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
  SELECT jsonb_build_object('allowed',true,'provider','fcm','category','operations','credential',k.credential,'notificationId',n.id,'url',n.link,'expiresAt',n.created_at+interval '24 hours') INTO payload
   FROM store_ops_private.push_deliveries d JOIN public.notification_log n ON n.id=d.notification_id
   JOIN public.attendance_notification_devices device ON device.id=d.device_id AND device.user_id=n.user_id AND device.enabled AND device.revoked_at IS NULL
   JOIN hrm_private.attendance_notification_keys k ON k.device_id=device.id
   JOIN public.store_operation_preferences preference ON preference.user_id=n.user_id AND preference.enabled AND preference.push_enabled
   JOIN public.profiles profile ON profile.id=n.user_id AND (profile.role='admin' OR profile.store_id=n.operations_store_id)
   WHERE d.id=(p_command->>'deliveryId')::uuid AND d.state='leased' AND d.lease_token=(p_command->>'leaseToken')::uuid AND d.lease_until>stamp AND n.created_at>stamp-interval '24 hours';
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
ALTER TABLE store_ops_private.push_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_ops_private.alert_keys ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.store_operation_events;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.store_ops_report(p_from date,p_to date,p_store uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; starts timestamptz:=p_from::timestamp AT TIME ZONE 'Asia/Kolkata'; ends timestamptz:=(p_to+1)::timestamp AT TIME ZONE 'Asia/Kolkata';
BEGIN
 IF NOT store_ops_private.manager() THEN RAISE EXCEPTION 'Manager permission required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366 THEN RAISE EXCEPTION 'Choose a reporting range of at most one year'; END IF;
 IF p_store IS NOT NULL AND NOT store_ops_private.in_store(p_store) THEN RAISE EXCEPTION 'Store is not authorized' USING ERRCODE='42501'; END IF;
 WITH inspections AS(SELECT * FROM public.shelf_inspections WHERE created_at>=starts AND created_at<ends AND (p_store IS NULL OR store_id=p_store)),
 damages AS(SELECT * FROM public.damage_reports WHERE created_at>=starts AND created_at<ends AND (p_store IS NULL OR store_id=p_store)),
 tasks AS(SELECT * FROM public.tasks WHERE created_at>=starts AND created_at<ends AND (p_store IS NULL OR store_id=p_store)),
 audits AS(SELECT * FROM public.audits WHERE created_at>=starts AND created_at<ends AND (p_store IS NULL OR store_id=p_store)),
 checklists AS(SELECT * FROM public.daily_checklists WHERE date BETWEEN p_from AND p_to AND superseded_at IS NULL AND (p_store IS NULL OR store_id=p_store)),
 incidents AS(SELECT * FROM public.incidents WHERE created_at>=starts AND created_at<ends AND (p_store IS NULL OR store_id=p_store)),
 events AS(SELECT * FROM public.store_operation_events WHERE created_at>=starts AND created_at<ends AND (p_store IS NULL OR store_id=p_store)),
 days AS(SELECT generate_series(p_from::timestamp,p_to::timestamp,interval '1 day')::date AS report_day),
 inspection_expected AS(SELECT count(*) expected FROM public.store_sections s CROSS JOIN days WHERE s.created_at<((days.report_day+1)::timestamp AT TIME ZONE 'Asia/Kolkata') AND (p_store IS NULL OR s.store_id=p_store)),
 checklist_expected AS(SELECT count(*)*(p_to-p_from+1) expected FROM (SELECT DISTINCT store_id,type FROM public.checklist_templates WHERE is_active AND (p_store IS NULL OR store_id=p_store)) templates)
 SELECT jsonb_build_object(
 'metrics',jsonb_build_object(
  'inspections',(SELECT count(*) FROM inspections),
  'inspection_completion',coalesce((SELECT least(100,round(100.0*(SELECT count(*) FROM(SELECT DISTINCT section_id,(created_at AT TIME ZONE 'Asia/Kolkata')::date FROM inspections) i)/nullif(expected,0))) FROM inspection_expected),0),
  'damage_reports',(SELECT count(*) FROM damages),'damage_value',(SELECT coalesce(sum(mrp*quantity) FILTER(WHERE status='approved'),0) FROM damages),
  'tasks',(SELECT count(*) FROM tasks),'task_completion',(SELECT coalesce(round(100.0*count(*) FILTER(WHERE status='completed')/nullif(count(*),0)),0) FROM tasks),
  'audit_score',(SELECT coalesce(round(avg(100*final_score/nullif(max_score,0)) FILTER(WHERE status='completed'),1),0) FROM audits),
  'checklist_compliance',coalesce((SELECT least(100,round(100.0*(SELECT count(*) FROM checklists WHERE status='completed')/nullif(expected,0))) FROM checklist_expected),0),
  'incidents',(SELECT count(*) FROM incidents),
  'tester_usage',(SELECT coalesce(sum(greatest(0,(previous_values->>'remaining_percentage')::integer-(next_values->>'remaining_percentage')::integer)),0) FROM events WHERE record_type='testers' AND action='update')
 ),
 'daily',coalesce((SELECT jsonb_agg(jsonb_build_object('date',report_day,'inspections',(SELECT count(*) FROM inspections WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date=report_day),
  'tasks',(SELECT count(*) FROM public.tasks WHERE completed_at>=report_day::timestamp AT TIME ZONE 'Asia/Kolkata' AND completed_at<(report_day+1)::timestamp AT TIME ZONE 'Asia/Kolkata' AND (p_store IS NULL OR store_id=p_store)),
  'incidents',(SELECT count(*) FROM incidents WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date=report_day),'damage_value',(SELECT coalesce(sum(mrp*quantity),0) FROM damages WHERE status='approved' AND (created_at AT TIME ZONE 'Asia/Kolkata')::date=report_day)) ORDER BY report_day) FROM days),'[]'::jsonb),
 'employees',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(p.full_name,'Staff'),
  'reports',(SELECT count(*) FROM events WHERE created_by=p.id AND action='insert' AND record_type IN ('shelf_inspections','damage_reports','incidents','restock_requests')),
  'tasks',(SELECT count(*) FROM public.tasks WHERE completed_by=p.id AND completed_at>=starts AND completed_at<ends AND (p_store IS NULL OR store_id=p_store)),
  'checklist_items',(SELECT count(*) FROM public.daily_checklist_items i JOIN checklists c ON c.id=i.daily_checklist_id WHERE i.completed_by=p.id AND i.is_completed)))
  FROM public.profiles p WHERE (p_store IS NULL OR p.store_id=p_store) AND (store_ops_private.actor_role()='admin' OR p.store_id=store_ops_private.actor_store()) AND p.role IN ('employee','manager')),'[]'::jsonb),
 'incident_types',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM(SELECT incident_type type,count(*) count FROM incidents GROUP BY incident_type ORDER BY count(*) DESC) t),'[]'::jsonb),
 'damage_returns',coalesce((SELECT jsonb_agg(jsonb_build_object('barcode',barcode,'product',product_name,'quantity',quantity,'mrp',coalesce(mrp,0),'value',coalesce(mrp,0)*quantity)) FROM damages WHERE status='approved'),'[]'::jsonb),
 'tester_usage',coalesce((SELECT jsonb_agg(jsonb_build_object('id',t.id,'product',t.product_name,'remaining',t.remaining_percentage,'needs_replacement',t.needs_replacement,'expiry',t.expiry_date,
  'used',coalesce((SELECT sum(greatest(0,(previous_values->>'remaining_percentage')::integer-(next_values->>'remaining_percentage')::integer)) FROM events WHERE record_type='testers' AND record_id=t.id AND action='update'),0))) FROM public.testers t WHERE p_store IS NULL OR t.store_id=p_store),'[]'::jsonb),
 'audit_history',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'date',(created_at AT TIME ZONE 'Asia/Kolkata')::date,'score',coalesce(round(100*final_score/nullif(max_score,0),1),0)) ORDER BY created_at) FROM audits WHERE status='completed'),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.store_ops_report(date,date,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.store_ops_report(date,date,uuid) TO authenticated;
REVOKE ALL ON public.store_operations_settings,public.store_operation_preferences FROM anon;
COMMIT;
