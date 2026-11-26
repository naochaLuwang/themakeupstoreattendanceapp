BEGIN;
-- Check the base schema before changing policies, functions or existing rows.
DO $prerequisites$
DECLARE missing_tables text;
BEGIN
 SELECT string_agg('public.' || name, ', ' ORDER BY name) INTO missing_tables
 FROM unnest(ARRAY[
  'profiles','stores','store_sections','shelf_inspections','inspection_images','inspection_comments',
  'damage_reports','damage_images','damage_comments','testers','tester_logs',
  'tasks','task_comments','task_attachments','audit_templates','audit_questions','audits','audit_answers',
  'incidents','incident_images','incident_comments','restock_requests','restock_items','notification_log',
  'checklist_templates','daily_checklists','daily_checklist_items'
 ]) AS required(name)
 WHERE to_regclass('public.' || name) IS NULL;
 IF missing_tables IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='42P01',
   MESSAGE='Store Operations base migrations are missing: ' || missing_tables,
   HINT='Apply 002_damage_reports.sql, 003_daily_checklist.sql and 004_remaining_modules.sql first, or run supabase/deployment/store_operations_install.sql as one complete script.';
 END IF;
END $prerequisites$;

CREATE SCHEMA IF NOT EXISTS store_ops_private;
REVOKE ALL ON SCHEMA store_ops_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA store_ops_private TO authenticated;

CREATE OR REPLACE FUNCTION store_ops_private.actor_role() RETURNS text
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT role FROM public.profiles WHERE id=(SELECT auth.uid())
$$;
CREATE OR REPLACE FUNCTION store_ops_private.actor_store() RETURNS uuid
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT store_id FROM public.profiles WHERE id=(SELECT auth.uid())
$$;
CREATE OR REPLACE FUNCTION store_ops_private.manager() RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(store_ops_private.actor_role() IN ('admin','manager'),false)
$$;
CREATE OR REPLACE FUNCTION store_ops_private.in_store(target uuid) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT coalesce(store_ops_private.actor_role()='admin' OR
   (target IS NOT NULL AND target=store_ops_private.actor_store()),false)
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA store_ops_private FROM PUBLIC,anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA store_ops_private TO authenticated;

-- Preserve legacy records; unassigned legacy data stays visible to admins only.
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['store_sections','shelf_inspections','damage_reports','testers','tasks',
 'audit_templates','audits','incidents','restock_requests','checklist_templates','daily_checklists'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES public.stores(id)',tbl);
  EXECUTE format('UPDATE public.%I r SET store_id=p.store_id FROM public.profiles p WHERE r.created_by=p.id AND r.store_id IS NULL',tbl);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(store_id)',tbl||'_store_scope_idx',tbl);
 END LOOP;
 UPDATE public.shelf_inspections r SET store_id=s.store_id FROM public.store_sections s WHERE r.section_id=s.id AND r.store_id IS NULL;
 UPDATE public.tasks r SET store_id=p.store_id FROM public.profiles p WHERE r.assigned_to=p.id AND r.store_id IS NULL;
 FOREACH tbl IN ARRAY ARRAY['inspection_images','inspection_comments','damage_images','damage_comments',
 'tester_logs','task_comments','task_attachments','audit_questions','audit_answers','incident_images',
 'incident_comments','restock_items','notification_log'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()',tbl);
 END LOOP;
END $$;
ALTER TABLE public.notification_log ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.audit_answers ADD COLUMN IF NOT EXISTS answered_at timestamptz;
UPDATE public.audit_answers SET answered_at=created_at WHERE score IS DISTINCT FROM 0 OR comment IS NOT NULL OR photo_url IS NOT NULL;

CREATE OR REPLACE FUNCTION store_ops_private.guard_record() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); role_name text:=store_ops_private.actor_role(); target uuid; parent_store uuid;
BEGIN
 IF actor IS NULL THEN
  IF current_setting('role',true) IN ('none','service_role') THEN RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END; END IF;
  RAISE EXCEPTION 'Sign in to manage store operations' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF TG_OP='INSERT' THEN
  NEW.created_by:=coalesce(NEW.created_by,actor);
  IF NEW.created_by<>actor THEN RAISE EXCEPTION 'Cannot submit for another user' USING ERRCODE='42501'; END IF;
  target:=coalesce(NEW.store_id,store_ops_private.actor_store());
  IF TG_TABLE_NAME='shelf_inspections' THEN
   SELECT store_id INTO parent_store FROM public.store_sections WHERE id=NEW.section_id;
   IF NEW.store_id IS NOT NULL AND NEW.store_id IS DISTINCT FROM parent_store THEN RAISE EXCEPTION 'Section belongs to another store'; END IF;
   target:=parent_store;
  ELSIF TG_TABLE_NAME='tasks' THEN
   IF target IS NULL AND NEW.assigned_to IS NOT NULL THEN SELECT store_id INTO target FROM public.profiles WHERE id=NEW.assigned_to; END IF;
  ELSIF TG_TABLE_NAME='daily_checklists' THEN
   SELECT store_id INTO parent_store FROM public.checklist_templates WHERE id=NEW.template_id;
   IF NOT FOUND OR (NEW.store_id IS NOT NULL AND NEW.store_id IS DISTINCT FROM parent_store) THEN RAISE EXCEPTION 'Checklist template belongs to another store' USING ERRCODE='42501'; END IF;
   target:=coalesce(NEW.store_id,parent_store,store_ops_private.actor_store());
  ELSIF TG_TABLE_NAME='audits' THEN
   SELECT store_id INTO parent_store FROM public.audit_templates WHERE id=NEW.template_id;
   IF NOT FOUND OR (NEW.store_id IS NOT NULL AND NEW.store_id IS DISTINCT FROM parent_store) THEN RAISE EXCEPTION 'Audit template belongs to another store' USING ERRCODE='42501'; END IF;
   target:=parent_store;
  END IF;
  IF target IS NULL OR NOT store_ops_private.in_store(target) THEN RAISE EXCEPTION 'Choose an authorized store' USING ERRCODE='42501'; END IF;
  NEW.store_id:=target;
  NEW.created_at:=clock_timestamp();
 ELSE
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_by IS DISTINCT FROM OLD.created_by OR
     NEW.store_id IS DISTINCT FROM OLD.store_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
   RAISE EXCEPTION 'Record identity and store cannot change' USING ERRCODE='42501';
  END IF;
 END IF;
 NEW.updated_at:=clock_timestamp();
 IF TG_TABLE_NAME='damage_reports' THEN
  IF TG_OP='INSERT' THEN
   IF NEW.reported_by<>actor OR NEW.status<>'pending' OR NEW.reviewed_by IS NOT NULL THEN RAISE EXCEPTION 'New damage reports must await approval'; END IF;
  ELSE
   IF NEW.reported_by IS DISTINCT FROM OLD.reported_by THEN RAISE EXCEPTION 'Reporter cannot change'; END IF;
   IF OLD.status='archived' AND (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN RAISE EXCEPTION 'Archived reports cannot be edited'; END IF;
   IF (to_jsonb(NEW)-'status'-'reviewed_by'-'reviewed_at'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'reviewed_by'-'reviewed_at'-'updated_at') THEN
    NEW.status:='pending';NEW.reviewed_by:=NULL;NEW.reviewed_at:=NULL;
   ELSIF NEW.status='pending' AND OLD.status<>'pending' THEN NEW.reviewed_by:=NULL;NEW.reviewed_at:=NULL;
   ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected','archived') THEN
    IF NOT ((OLD.status='pending' AND NEW.status IN ('approved','rejected')) OR (OLD.status IN ('approved','rejected') AND NEW.status='archived')) THEN RAISE EXCEPTION 'Invalid damage approval transition'; END IF;
    IF NOT store_ops_private.manager() THEN RAISE EXCEPTION 'Manager approval is required' USING ERRCODE='42501'; END IF;
    NEW.reviewed_by:=actor;NEW.reviewed_at:=clock_timestamp();
   ELSIF (NEW.reviewed_by,NEW.reviewed_at) IS DISTINCT FROM (OLD.reviewed_by,OLD.reviewed_at) THEN RAISE EXCEPTION 'Review attribution is managed by approval transitions';
   END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME IN ('damage_reports','restock_requests') AND role_name='employee' THEN
  IF TG_OP='UPDATE' OR NEW.status<>'pending' THEN RAISE EXCEPTION 'Manager approval is required' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='damage_reports' THEN
   IF NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL OR NEW.reported_by<>actor THEN RAISE EXCEPTION 'Invalid report attribution'; END IF;
  ELSE
   IF NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL THEN RAISE EXCEPTION 'Invalid approval attribution'; END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='shelf_inspections' THEN
  IF TG_OP='INSERT' AND (NEW.employee_id<>actor OR NEW.reviewed_by IS NOT NULL OR NEW.reviewed_at IS NOT NULL) THEN RAISE EXCEPTION 'Invalid inspection attribution'; END IF;
  IF TG_OP='UPDATE' THEN
   IF NEW.section_id IS DISTINCT FROM OLD.section_id THEN
    SELECT store_id INTO parent_store FROM public.store_sections WHERE id=NEW.section_id;
    IF parent_store IS DISTINCT FROM OLD.store_id THEN RAISE EXCEPTION 'Section belongs to another store'; END IF;
   END IF;
   IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN RAISE EXCEPTION 'Inspector cannot change'; END IF;
   IF (NEW.notes,NEW.status,NEW.section_id) IS DISTINCT FROM (OLD.notes,OLD.status,OLD.section_id) THEN NEW.reviewed_by:=NULL; NEW.reviewed_at:=NULL; END IF;
   IF NEW.reviewed_by IS NOT NULL AND ((NEW.reviewed_by,NEW.reviewed_at) IS DISTINCT FROM (OLD.reviewed_by,OLD.reviewed_at)) THEN
    IF NOT store_ops_private.manager() OR NEW.reviewed_by<>actor THEN RAISE EXCEPTION 'Manager approval is required' USING ERRCODE='42501'; END IF;
    NEW.reviewed_at:=clock_timestamp();
   END IF;
  END IF;
 ELSIF TG_TABLE_NAME='tasks' THEN
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.assigned_to AND store_id=NEW.store_id) THEN RAISE EXCEPTION 'Assignee must belong to the task store'; END IF;
  IF TG_OP='UPDATE' AND role_name='employee' AND
   (OLD.assigned_to IS DISTINCT FROM actor OR
    (to_jsonb(NEW)-'status'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'status'-'updated_at') OR
    OLD.status='cancelled' OR NEW.status NOT IN ('pending','in_progress','completed')) THEN
   RAISE EXCEPTION 'Only the assigned task status can be changed' USING ERRCODE='42501';
  END IF;
 ELSIF TG_TABLE_NAME='incidents' THEN
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=NEW.assigned_to AND store_id=NEW.store_id) THEN RAISE EXCEPTION 'Assignee must belong to the incident store'; END IF;
  IF NEW.voice_note_url IS NOT NULL THEN
   IF TG_OP='INSERT' THEN
    IF NEW.voice_note_url NOT LIKE '/api/store-ops/media?path=incidents/%' OR split_part(split_part(NEW.voice_note_url,'path=',2),'/',2)<>actor::text THEN RAISE EXCEPTION 'Invalid voice note owner'; END IF;
   ELSIF NEW.voice_note_url IS DISTINCT FROM OLD.voice_note_url THEN
    IF NEW.voice_note_url NOT LIKE '/api/store-ops/media?path=incidents/%' OR split_part(split_part(NEW.voice_note_url,'path=',2),'/',2)<>actor::text THEN RAISE EXCEPTION 'Invalid voice note owner'; END IF;
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION store_ops_private.guard_child() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NULL AND current_setting('role',true) IN ('none','service_role') THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' AND NEW.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Invalid author' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME IN ('inspection_images','damage_images','task_attachments','incident_images') THEN
  IF TG_OP='INSERT' THEN
   IF NEW.url NOT LIKE '/api/store-ops/media?path=%' OR split_part(split_part(NEW.url,'path=',2),'/',2) IS DISTINCT FROM auth.uid()::text OR NEW.url LIKE '%..%' THEN
    RAISE EXCEPTION 'Photo must be uploaded by the submitting user' USING ERRCODE='42501';
   END IF;
  ELSIF NEW.url IS DISTINCT FROM OLD.url THEN RAISE EXCEPTION 'Photo references are immutable';
  END IF;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.id IS DISTINCT FROM OLD.id OR
  NEW.created_at IS DISTINCT FROM OLD.created_at OR to_jsonb(NEW)->TG_ARGV[0] IS DISTINCT FROM to_jsonb(OLD)->TG_ARGV[0]) THEN
  RAISE EXCEPTION 'Child identity and parent cannot change' USING ERRCODE='42501';
 END IF;
 IF TG_TABLE_NAME='audit_answers' THEN
  IF NOT EXISTS(SELECT 1 FROM public.audit_questions q JOIN public.audits a ON a.template_id=q.template_id
    WHERE a.id=NEW.audit_id AND q.id=NEW.question_id AND a.status='in_progress' AND NEW.score BETWEEN 0 AND q.max_score) THEN
    RAISE EXCEPTION 'Answer must belong to an open audit and score must be within its maximum';
  END IF;
  IF TG_OP='UPDATE' THEN NEW.answered_at:=clock_timestamp(); END IF;
 END IF;
 IF TG_TABLE_NAME IN ('audit_answers','daily_checklist_items') THEN
  IF NEW.photo_url IS NOT NULL THEN
   IF TG_OP='INSERT' THEN
    IF NEW.photo_url NOT LIKE '/api/store-ops/media?path=%' OR split_part(split_part(NEW.photo_url,'path=',2),'/',2)<>auth.uid()::text THEN RAISE EXCEPTION 'Invalid photo owner'; END IF;
   ELSIF NEW.photo_url IS DISTINCT FROM OLD.photo_url THEN
    IF NEW.photo_url NOT LIKE '/api/store-ops/media?path=%' OR split_part(split_part(NEW.photo_url,'path=',2),'/',2)<>auth.uid()::text THEN RAISE EXCEPTION 'Invalid photo owner'; END IF;
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION store_ops_private.guard_child() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE item text[]; BEGIN
 FOREACH item SLICE 1 IN ARRAY ARRAY[
 ['inspection_images','inspection_id'],['inspection_comments','inspection_id'],['damage_images','damage_report_id'],['damage_comments','damage_report_id'],
 ['tester_logs','tester_id'],['task_comments','task_id'],['task_attachments','task_id'],['audit_questions','template_id'],['audit_answers','audit_id'],
 ['incident_images','incident_id'],['incident_comments','incident_id'],['restock_items','restock_request_id'],['daily_checklist_items','daily_checklist_id']
 ] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS ops_child_guard ON public.%I',item[1]);
  EXECUTE format('CREATE TRIGGER ops_child_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION store_ops_private.guard_child(%L)',item[1],item[2]);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION store_ops_private.guard_record() FROM PUBLIC,anon,authenticated;

DO $$ DECLARE tbl text; pol record; manager_only boolean; scope text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['store_sections','shelf_inspections','damage_reports','testers','tasks',
 'audit_templates','audits','incidents','restock_requests','checklist_templates','daily_checklists'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',tbl);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',tbl);
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',pol.policyname,tbl);
  END LOOP;
  manager_only:=tbl IN ('store_sections','testers','tasks','audit_templates','audits','checklist_templates');
  scope:='store_ops_private.in_store(store_id)';
  IF tbl='tasks' THEN scope:=scope||' AND (store_ops_private.manager() OR assigned_to=auth.uid())'; END IF;
  EXECUTE format('CREATE POLICY ops_read ON public.%I FOR SELECT TO authenticated USING (%s)',tbl,scope);
  EXECUTE format('CREATE POLICY ops_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND store_ops_private.in_store(store_id) %s)',tbl,CASE WHEN manager_only THEN 'AND store_ops_private.manager()' ELSE '' END);
  EXECUTE format('CREATE POLICY ops_update ON public.%I FOR UPDATE TO authenticated USING (%s AND (store_ops_private.manager() %s)) WITH CHECK (%s AND (store_ops_private.manager() %s))',tbl,scope,
   CASE WHEN tbl='tasks' THEN 'OR assigned_to=auth.uid()' WHEN tbl='daily_checklists' THEN 'OR created_by=auth.uid()' ELSE '' END,scope,
   CASE WHEN tbl='tasks' THEN 'OR assigned_to=auth.uid()' WHEN tbl='daily_checklists' THEN 'OR created_by=auth.uid()' ELSE '' END);
  EXECUTE format('CREATE POLICY ops_delete ON public.%I FOR DELETE TO authenticated USING (store_ops_private.actor_role()=''admin'')',tbl);
  EXECUTE format('DROP TRIGGER IF EXISTS ops_guard ON public.%I',tbl);
  EXECUTE format('CREATE TRIGGER ops_guard BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION store_ops_private.guard_record()',tbl);
 END LOOP;
END $$;

-- Child access follows the parent RLS, rather than trusting a supplied parent ID.
DO $$ DECLARE item text[]; tbl text; parent text; fk text; pol record; restricted text; BEGIN
 FOREACH item SLICE 1 IN ARRAY ARRAY[
 ['inspection_images','shelf_inspections','inspection_id'],['inspection_comments','shelf_inspections','inspection_id'],
 ['damage_images','damage_reports','damage_report_id'],['damage_comments','damage_reports','damage_report_id'],
 ['tester_logs','testers','tester_id'],['task_comments','tasks','task_id'],['task_attachments','tasks','task_id'],
 ['audit_questions','audit_templates','template_id'],['audit_answers','audits','audit_id'],
 ['incident_images','incidents','incident_id'],['incident_comments','incidents','incident_id'],
 ['restock_items','restock_requests','restock_request_id'],['daily_checklist_items','daily_checklists','daily_checklist_id']
 ] LOOP
  tbl:=item[1]; parent:=item[2]; fk:=item[3];
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',tbl);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',tbl);
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=tbl LOOP EXECUTE format('DROP POLICY %I ON public.%I',pol.policyname,tbl); END LOOP;
  restricted:=CASE WHEN tbl IN ('audit_questions','audit_answers') THEN ' AND store_ops_private.manager()' ELSE '' END;
  EXECUTE format('CREATE POLICY ops_read ON public.%I FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.%I p WHERE p.id=%I))',tbl,parent,fk);
  EXECUTE format('CREATE POLICY ops_insert ON public.%I FOR INSERT TO authenticated WITH CHECK(created_by=auth.uid() AND EXISTS(SELECT 1 FROM public.%I p WHERE p.id=%I)%s)',tbl,parent,fk,restricted);
  EXECUTE format('CREATE POLICY ops_update ON public.%I FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.%I p WHERE p.id=%I) AND (store_ops_private.manager() OR created_by=auth.uid())%s) WITH CHECK(EXISTS(SELECT 1 FROM public.%I p WHERE p.id=%I) AND (store_ops_private.manager() OR created_by=auth.uid())%s)',tbl,parent,fk,restricted,parent,fk,restricted);
  EXECUTE format('CREATE POLICY ops_delete ON public.%I FOR DELETE TO authenticated USING (EXISTS(SELECT 1 FROM public.%I p WHERE p.id=%I) AND (store_ops_private.actor_role()=''admin'' OR created_by=auth.uid()))',tbl,parent,fk);
  EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I',tbl,tbl);
  EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',tbl,tbl);
 END LOOP;
END $$;

-- Recipient scope also restricts the older permissive notification policies.
DO $$ DECLARE item text[]; BEGIN
 FOREACH item SLICE 1 IN ARRAY ARRAY[['inspection_images','shelf_inspections','inspection_id'],['damage_images','damage_reports','damage_report_id'],['incident_images','incidents','incident_id'],['task_attachments','tasks','task_id']] LOOP
  EXECUTE format('DROP POLICY ops_delete ON public.%I',item[1]);
  EXECUTE format('CREATE POLICY ops_delete ON public.%I FOR DELETE TO authenticated USING(EXISTS(SELECT 1 FROM public.%I p WHERE p.id=%I) AND (store_ops_private.manager() OR created_by=auth.uid()))',item[1],item[2],item[3]);
 END LOOP;
END $$;
REVOKE ALL ON public.notification_log FROM anon,authenticated;
GRANT SELECT,UPDATE ON public.notification_log TO authenticated;
DROP POLICY IF EXISTS ops_recipient ON public.notification_log;
CREATE POLICY ops_recipient ON public.notification_log AS RESTRICTIVE FOR ALL TO authenticated
 USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE OR REPLACE FUNCTION store_ops_private.protect_notice() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF auth.uid() IS NOT NULL AND TG_OP='UPDATE' AND
 (to_jsonb(NEW)-'is_read'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'is_read'-'updated_at') THEN
  RAISE EXCEPTION 'Only notification read status can change' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION store_ops_private.protect_notice() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS ops_protect_notice ON public.notification_log;
CREATE TRIGGER ops_protect_notice BEFORE UPDATE ON public.notification_log FOR EACH ROW EXECUTE FUNCTION store_ops_private.protect_notice();

DO $$ DECLARE tbl text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH tbl IN ARRAY ARRAY['shelf_inspections','inspection_images','inspection_comments','damage_reports','damage_comments',
   'testers','tester_logs','tasks','task_comments','task_attachments','audits','audit_answers',
   'daily_checklists','daily_checklist_items','incidents','incident_comments','restock_requests','restock_items'] LOOP
   IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=tbl) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',tbl);
   END IF;
  END LOOP;
 END IF;
END $$;
-- Private media keeps photos behind the same session and record scope as forms.
CREATE OR REPLACE FUNCTION store_ops_private.media_referenced(object_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(
  SELECT 1 FROM (
   SELECT url FROM public.inspection_images UNION ALL SELECT url FROM public.damage_images
   UNION ALL SELECT url FROM public.task_attachments UNION ALL SELECT url FROM public.incident_images
   UNION ALL SELECT photo_url FROM public.daily_checklists UNION ALL SELECT photo_url FROM public.daily_checklist_items
   UNION ALL SELECT photo_url FROM public.audit_answers UNION ALL SELECT voice_note_url FROM public.incidents
  ) media WHERE right(media.url,length(object_path))=object_path
 )
$$;
CREATE OR REPLACE FUNCTION store_ops_private.can_read_media(object_path text) RETURNS boolean
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (
  split_part(object_path,'/',2)=auth.uid()::text OR EXISTS(
   SELECT 1 FROM (
    SELECT url FROM public.inspection_images UNION ALL SELECT url FROM public.damage_images
    UNION ALL SELECT url FROM public.task_attachments UNION ALL SELECT url FROM public.incident_images
    UNION ALL SELECT photo_url FROM public.daily_checklists UNION ALL SELECT photo_url FROM public.daily_checklist_items
    UNION ALL SELECT photo_url FROM public.audit_answers UNION ALL SELECT voice_note_url FROM public.incidents
   ) media WHERE right(media.url,length(object_path))=object_path
  )
 )
$$;
REVOKE ALL ON FUNCTION store_ops_private.media_referenced(text),store_ops_private.can_read_media(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION store_ops_private.media_referenced(text),store_ops_private.can_read_media(text) TO authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('store-images','store-images',false,5242880,ARRAY['image/jpeg','image/png','image/webp','audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=5242880,allowed_mime_types=EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS ops_media_read ON storage.objects;
CREATE POLICY ops_media_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='store-images' AND store_ops_private.can_read_media(regexp_replace(name,'\.thumb\.jpg$','.jpg')));
DROP POLICY IF EXISTS ops_media_upload ON storage.objects;
CREATE POLICY ops_media_upload ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='store-images' AND split_part(name,'/',2)=(SELECT auth.uid())::text AND EXISTS(SELECT 1 FROM public.profiles WHERE id=(SELECT auth.uid())));
DROP POLICY IF EXISTS ops_media_delete ON storage.objects;
CREATE POLICY ops_media_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='store-images' AND (split_part(name,'/',2)=(SELECT auth.uid())::text OR store_ops_private.manager())
 AND NOT store_ops_private.media_referenced(regexp_replace(name,'\.thumb\.jpg$','.jpg')));
-- Restrictive counterparts also constrain any older, broader bucket policies.
CREATE POLICY ops_media_read_scope ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated
 USING(bucket_id<>'store-images' OR (auth.uid() IS NOT NULL AND store_ops_private.can_read_media(regexp_replace(name,'\.thumb\.jpg$','.jpg'))));
CREATE POLICY ops_media_insert_scope ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(bucket_id<>'store-images' OR (auth.uid() IS NOT NULL AND split_part(name,'/',2)=auth.uid()::text));
CREATE POLICY ops_media_update_scope ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING(bucket_id<>'store-images') WITH CHECK(bucket_id<>'store-images');
CREATE POLICY ops_media_delete_scope ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
 USING(bucket_id<>'store-images' OR (auth.uid() IS NOT NULL AND (split_part(name,'/',2)=auth.uid()::text OR store_ops_private.manager()) AND NOT store_ops_private.media_referenced(regexp_replace(name,'\.thumb\.jpg$','.jpg'))));
CREATE POLICY ops_media_anon_scope ON storage.objects AS RESTRICTIVE FOR ALL TO anon USING(bucket_id<>'store-images') WITH CHECK(bucket_id<>'store-images');
COMMIT;
