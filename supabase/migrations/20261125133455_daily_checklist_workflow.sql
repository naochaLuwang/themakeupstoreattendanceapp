BEGIN;
CREATE TABLE public.checklist_template_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template_id uuid NOT NULL REFERENCES public.checklist_templates(id) ON DELETE CASCADE,
 label text NOT NULL CHECK(length(btrim(label)) BETWEEN 1 AND 300), sort_order integer NOT NULL DEFAULT 0,
 is_required boolean NOT NULL DEFAULT true, requires_photo boolean NOT NULL DEFAULT false,is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),created_by uuid NOT NULL REFERENCES public.profiles(id)
);
ALTER TABLE public.checklist_templates ADD COLUMN requires_photo boolean NOT NULL DEFAULT false;
ALTER TABLE public.daily_checklists ADD COLUMN superseded_at timestamptz;
ALTER TABLE public.daily_checklist_items ADD COLUMN template_item_id uuid REFERENCES public.checklist_template_items(id) ON DELETE SET NULL;
ALTER TABLE public.daily_checklist_items ADD COLUMN is_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.daily_checklist_items ADD COLUMN requires_photo boolean NOT NULL DEFAULT false;
-- Preserve duplicate legacy checklists in history rather than deleting submitted work.
WITH ranked AS(SELECT id,row_number() OVER(PARTITION BY store_id,date,type ORDER BY (status='completed') DESC,created_at DESC,id) rank FROM public.daily_checklists)
 UPDATE public.daily_checklists c SET superseded_at=now() FROM ranked r WHERE c.id=r.id AND r.rank>1;
CREATE UNIQUE INDEX checklist_active_store_day_type ON public.daily_checklists(store_id,date,type) WHERE superseded_at IS NULL;
CREATE UNIQUE INDEX checklist_item_snapshot_unique ON public.daily_checklist_items(daily_checklist_id,template_item_id) WHERE template_item_id IS NOT NULL;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.checklist_template_items FROM authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.checklist_template_items TO authenticated;
REVOKE ALL ON public.checklist_template_items FROM anon;
CREATE POLICY template_item_read ON public.checklist_template_items FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.checklist_templates t WHERE t.id=template_id));
CREATE POLICY template_item_manage ON public.checklist_template_items FOR ALL TO authenticated USING(store_ops_private.manager() AND EXISTS(SELECT 1 FROM public.checklist_templates t WHERE t.id=template_id))
 WITH CHECK(store_ops_private.manager() AND EXISTS(SELECT 1 FROM public.checklist_templates t WHERE t.id=template_id));
CREATE TRIGGER template_item_timestamp BEFORE UPDATE ON public.checklist_template_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.store_ops_checklist_template(p_id uuid,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE template public.checklist_templates; item text; position integer:=0;
BEGIN
 IF NOT store_ops_private.manager() THEN RAISE EXCEPTION 'Manager permission required' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(p_data->>'name'),'') IS NULL OR p_data->>'type' NOT IN ('opening','closing') OR
 jsonb_typeof(p_data->'items')<>'array' OR jsonb_array_length(p_data->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Add a name, type and 1–100 items'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.checklist_templates(name,type,store_id,requires_photo,created_by) VALUES(btrim(p_data->>'name'),p_data->>'type',(p_data->>'store_id')::uuid,coalesce((p_data->>'requires_photo')::boolean,p_data->>'type'='closing'),auth.uid()) RETURNING * INTO template;
 ELSE
  UPDATE public.checklist_templates SET name=btrim(p_data->>'name'),type=p_data->>'type',requires_photo=coalesce((p_data->>'requires_photo')::boolean,requires_photo) WHERE id=p_id RETURNING * INTO template;
  IF NOT FOUND THEN RAISE EXCEPTION 'Template unavailable'; END IF;
  UPDATE public.checklist_template_items SET is_active=false WHERE template_id=p_id AND is_active;
 END IF;
 FOR item IN SELECT jsonb_array_elements_text(p_data->'items') LOOP
  INSERT INTO public.checklist_template_items(template_id,label,sort_order,created_by) VALUES(template.id,btrim(item),position,auth.uid()); position:=position+1;
 END LOOP;
 RETURN to_jsonb(template);
END $$;

CREATE OR REPLACE FUNCTION public.store_ops_checklist_start(p_template uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE template public.checklist_templates; checklist public.daily_checklists; today date:=(clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING ERRCODE='42501'; END IF;
 SELECT * INTO template FROM public.checklist_templates WHERE id=p_template AND is_active;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.checklist_template_items WHERE template_id=p_template AND is_active) THEN RAISE EXCEPTION 'Choose an active template with at least one item'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(template.store_id::text||today::text||template.type,0));
 SELECT * INTO checklist FROM public.daily_checklists WHERE store_id=template.store_id AND date=today AND type=template.type AND superseded_at IS NULL;
 IF FOUND THEN RETURN to_jsonb(checklist); END IF;
 INSERT INTO public.daily_checklists(template_id,type,date,store_id,created_by) VALUES(template.id,template.type,today,template.store_id,auth.uid()) RETURNING * INTO checklist;
 INSERT INTO public.daily_checklist_items(daily_checklist_id,template_item_id,label,is_required,requires_photo,sort_order,created_by)
 SELECT checklist.id,id,label,is_required,requires_photo,sort_order,auth.uid() FROM public.checklist_template_items WHERE template_id=template.id AND is_active;
 RETURN to_jsonb(checklist);
END $$;

CREATE OR REPLACE FUNCTION store_ops_private.validate_checklist() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE checklist public.daily_checklists; template_item public.checklist_template_items;
BEGIN
 IF auth.uid() IS NULL AND current_setting('role',true) IN ('none','service_role') THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='daily_checklists' THEN
  IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM public.checklist_templates WHERE id=NEW.template_id AND type=NEW.type AND store_id=NEW.store_id AND is_active) THEN RAISE EXCEPTION 'Choose an active template from this store with the matching type'; END IF;
  IF TG_OP='INSERT' AND (NEW.status<>'in_progress' OR NEW.date<>(clock_timestamp() AT TIME ZONE 'Asia/Kolkata')::date) THEN RAISE EXCEPTION 'Invalid checklist start'; END IF;
  IF TG_OP='UPDATE' THEN
   IF NEW.template_id IS DISTINCT FROM OLD.template_id OR NEW.type IS DISTINCT FROM OLD.type OR NEW.date IS DISTINCT FROM OLD.date OR NEW.superseded_at IS DISTINCT FROM OLD.superseded_at THEN RAISE EXCEPTION 'Checklist identity cannot change'; END IF;
   IF OLD.status='completed' THEN RAISE EXCEPTION 'Completed checklists are retained as history'; END IF;
   IF NEW.status='completed' THEN
    IF NOT EXISTS(SELECT 1 FROM public.daily_checklist_items WHERE daily_checklist_id=NEW.id) OR
     EXISTS(SELECT 1 FROM public.daily_checklist_items WHERE daily_checklist_id=NEW.id AND is_required AND (NOT is_completed OR (requires_photo AND photo_url IS NULL))) THEN RAISE EXCEPTION 'Complete all mandatory items first'; END IF;
    IF EXISTS(SELECT 1 FROM public.checklist_templates WHERE id=NEW.template_id AND requires_photo) AND nullif(NEW.photo_url,'') IS NULL THEN RAISE EXCEPTION 'Upload the required checklist photo'; END IF;
    NEW.completed_by:=auth.uid(); NEW.completed_at:=clock_timestamp();
   ELSIF NEW.status<>'in_progress' AND NOT store_ops_private.manager() THEN RAISE EXCEPTION 'Manager permission required'; END IF;
  END IF;
  IF NEW.photo_url IS NOT NULL THEN
   IF TG_OP='INSERT' THEN
    IF split_part(split_part(NEW.photo_url,'path=',2),'/',2)<>auth.uid()::text THEN RAISE EXCEPTION 'Invalid photo owner'; END IF;
   ELSIF NEW.photo_url IS DISTINCT FROM OLD.photo_url THEN
    IF NEW.photo_url NOT LIKE '/api/store-ops/media?path=checklists/%' OR split_part(split_part(NEW.photo_url,'path=',2),'/',2)<>auth.uid()::text THEN RAISE EXCEPTION 'Invalid photo owner'; END IF;
   END IF;
  END IF;
 ELSE
  SELECT * INTO checklist FROM public.daily_checklists WHERE id=NEW.daily_checklist_id;
  IF NOT FOUND OR checklist.status<>'in_progress' THEN RAISE EXCEPTION 'Checklist is no longer open'; END IF;
  IF TG_OP='INSERT' THEN
   SELECT * INTO template_item FROM public.checklist_template_items WHERE id=NEW.template_item_id AND template_id=checklist.template_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Item must come from the checklist template'; END IF;
   NEW.label:=template_item.label; NEW.is_required:=template_item.is_required; NEW.requires_photo:=template_item.requires_photo; NEW.sort_order:=template_item.sort_order;
  ELSE
   IF (NEW.label,NEW.is_required,NEW.requires_photo,NEW.template_item_id,NEW.sort_order) IS DISTINCT FROM (OLD.label,OLD.is_required,OLD.requires_photo,OLD.template_item_id,OLD.sort_order) THEN RAISE EXCEPTION 'Checklist item definition cannot change'; END IF;
   NEW.completed_by:=CASE WHEN NEW.is_completed THEN auth.uid() ELSE NULL END;
   NEW.completed_at:=CASE WHEN NEW.is_completed THEN clock_timestamp() ELSE NULL END;
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION store_ops_private.validate_checklist() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ops_validate_checklist BEFORE INSERT OR UPDATE ON public.daily_checklists FOR EACH ROW EXECUTE FUNCTION store_ops_private.validate_checklist();
CREATE TRIGGER ops_validate_checklist_item BEFORE INSERT OR UPDATE ON public.daily_checklist_items FOR EACH ROW EXECUTE FUNCTION store_ops_private.validate_checklist();
-- Colleagues in the same store may complete the shared daily checklist.
DROP POLICY ops_update ON public.daily_checklists;
CREATE POLICY ops_update ON public.daily_checklists FOR UPDATE TO authenticated USING(store_ops_private.in_store(store_id)) WITH CHECK(store_ops_private.in_store(store_id));
DROP POLICY ops_update ON public.daily_checklist_items;
CREATE POLICY ops_update ON public.daily_checklist_items FOR UPDATE TO authenticated USING(EXISTS(SELECT 1 FROM public.daily_checklists p WHERE p.id=daily_checklist_id)) WITH CHECK(EXISTS(SELECT 1 FROM public.daily_checklists p WHERE p.id=daily_checklist_id));
DROP POLICY ops_delete ON public.daily_checklist_items;
CREATE POLICY ops_delete ON public.daily_checklist_items FOR DELETE TO authenticated USING(store_ops_private.actor_role()='admin');
REVOKE ALL ON FUNCTION public.store_ops_checklist_template(uuid,jsonb),public.store_ops_checklist_start(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.store_ops_checklist_template(uuid,jsonb),public.store_ops_checklist_start(uuid) TO authenticated;
COMMIT;
