BEGIN;
CREATE OR REPLACE FUNCTION public.store_ops_incident_save(p_id uuid,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE incident public.incidents; image text; voice text:=nullif(p_data->>'voice_note_url','');
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(p_data->>'title'),'') IS NULL OR jsonb_typeof(p_data->'image_urls')<>'array' OR jsonb_array_length(p_data->'image_urls')>5 THEN RAISE EXCEPTION 'Invalid incident'; END IF;
 IF voice IS NOT NULL AND (voice NOT LIKE '/api/store-ops/media?path=incidents/%' OR split_part(split_part(voice,'path=',2),'/',2)<>auth.uid()::text OR voice LIKE '%..%') THEN
  IF p_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.incidents WHERE id=p_id AND voice_note_url=voice) THEN RAISE EXCEPTION 'Invalid voice note'; END IF;
 END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.incidents(title,description,incident_type,priority,store_id,voice_note_url,created_by)
   VALUES(btrim(p_data->>'title'),p_data->>'description',p_data->>'incident_type',p_data->>'priority',(p_data->>'store_id')::uuid,voice,auth.uid()) RETURNING * INTO incident;
 ELSE
  IF NOT store_ops_private.manager() THEN RAISE EXCEPTION 'Manager permission required' USING ERRCODE='42501'; END IF;
  UPDATE public.incidents SET title=btrim(p_data->>'title'),description=p_data->>'description',incident_type=p_data->>'incident_type',priority=p_data->>'priority',voice_note_url=voice WHERE id=p_id RETURNING * INTO incident;
  IF NOT FOUND THEN RAISE EXCEPTION 'Incident unavailable'; END IF;
  DELETE FROM public.incident_images WHERE incident_id=p_id AND url NOT IN(SELECT jsonb_array_elements_text(p_data->'image_urls'));
 END IF;
 FOR image IN SELECT DISTINCT jsonb_array_elements_text(p_data->'image_urls') LOOP
  IF EXISTS(SELECT 1 FROM public.incident_images WHERE incident_id=incident.id AND url=image) THEN CONTINUE; END IF;
  INSERT INTO public.incident_images(incident_id,url,created_by) VALUES(incident.id,image,auth.uid());
 END LOOP;
 RETURN to_jsonb(incident);
END $$;

ALTER TABLE public.restock_items ADD CONSTRAINT restock_quantities_positive CHECK(quantity_needed>0 AND (quantity_approved IS NULL OR quantity_approved BETWEEN 0 AND quantity_needed)) NOT VALID;
CREATE OR REPLACE FUNCTION public.store_ops_restock_save(p_id uuid,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE request public.restock_requests; item jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_data->'items')<>'array' OR jsonb_array_length(p_data->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Add 1–100 restock items'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.restock_requests(notes,store_id,created_by) VALUES(p_data->>'notes',(p_data->>'store_id')::uuid,auth.uid()) RETURNING * INTO request;
 ELSE
  IF NOT store_ops_private.manager() THEN RAISE EXCEPTION 'Manager permission required' USING ERRCODE='42501'; END IF;
  UPDATE public.restock_requests SET notes=p_data->>'notes',supplier_notes=p_data->>'supplier_notes' WHERE id=p_id AND status='pending' RETURNING * INTO request;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only a pending request can be edited'; END IF;
  DELETE FROM public.restock_items WHERE restock_request_id=p_id;
 END IF;
 FOR item IN SELECT jsonb_array_elements(p_data->'items') LOOP
  IF nullif(btrim(item->>'barcode'),'') IS NULL OR nullif(btrim(item->>'product_name'),'') IS NULL THEN RAISE EXCEPTION 'Each item needs a barcode and product name'; END IF;
  INSERT INTO public.restock_items(restock_request_id,barcode,product_name,brand,quantity_needed,supplier_notes,created_by)
   VALUES(request.id,btrim(item->>'barcode'),btrim(item->>'product_name'),item->>'brand',(item->>'quantity_needed')::integer,item->>'supplier_notes',auth.uid());
 END LOOP;
 RETURN to_jsonb(request);
END $$;
DROP POLICY ops_delete ON public.restock_items;
CREATE POLICY ops_delete ON public.restock_items FOR DELETE TO authenticated USING(store_ops_private.manager() AND EXISTS(SELECT 1 FROM public.restock_requests p WHERE p.id=restock_request_id));
CREATE OR REPLACE FUNCTION store_ops_private.restock_transition() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'pending' OR NEW.approved_by IS NOT NULL THEN RAISE EXCEPTION 'New requests must await approval'; END IF;
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
  IF NOT store_ops_private.manager() THEN RAISE EXCEPTION 'Manager permission required' USING ERRCODE='42501'; END IF;
  IF OLD.status='pending' AND NEW.status IN ('approved','rejected') THEN
   IF NOT EXISTS(SELECT 1 FROM public.restock_items WHERE restock_request_id=NEW.id) THEN RAISE EXCEPTION 'Request has no items'; END IF;
   NEW.approved_by:=auth.uid(); NEW.approved_at:=clock_timestamp();
   IF NEW.status='approved' THEN UPDATE public.restock_items SET quantity_approved=quantity_needed WHERE restock_request_id=NEW.id; END IF;
  ELSIF NOT (OLD.status='approved' AND NEW.status='completed') THEN RAISE EXCEPTION 'Invalid restock status transition'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION store_ops_private.restock_transition() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ops_restock_transition BEFORE INSERT OR UPDATE ON public.restock_requests FOR EACH ROW EXECUTE FUNCTION store_ops_private.restock_transition();
REVOKE ALL ON FUNCTION public.store_ops_incident_save(uuid,jsonb),public.store_ops_restock_save(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.store_ops_incident_save(uuid,jsonb),public.store_ops_restock_save(uuid,jsonb) TO authenticated;
COMMIT;
