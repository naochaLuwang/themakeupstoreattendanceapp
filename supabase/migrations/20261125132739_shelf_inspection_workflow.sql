BEGIN;
CREATE OR REPLACE FUNCTION public.store_ops_shelf_save(p_id uuid,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.shelf_inspections; image text; image_path text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING ERRCODE='42501'; END IF;
 IF p_data->>'status' NOT IN ('good','needs_restock','dirty','wrong_display','missing_tester','missing_price_tag','damaged_display') OR
  length(coalesce(p_data->>'notes',''))>5000 OR jsonb_typeof(p_data->'image_urls')<>'array' OR jsonb_array_length(p_data->'image_urls')>5 THEN
  RAISE EXCEPTION 'Invalid inspection';
 END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.shelf_inspections(section_id,employee_id,status,notes,created_by)
   VALUES((p_data->>'section_id')::uuid,auth.uid(),p_data->>'status',nullif(btrim(p_data->>'notes'),''),auth.uid()) RETURNING * INTO result;
 ELSE
  IF NOT store_ops_private.manager() THEN RAISE EXCEPTION 'Manager permission required' USING ERRCODE='42501'; END IF;
  UPDATE public.shelf_inspections SET section_id=(p_data->>'section_id')::uuid,status=p_data->>'status',notes=nullif(btrim(p_data->>'notes'),'')
   WHERE id=p_id RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inspection unavailable or not authorized' USING ERRCODE='42501'; END IF;
  DELETE FROM public.inspection_images WHERE inspection_id=p_id AND url NOT IN(SELECT jsonb_array_elements_text(p_data->'image_urls'));
 END IF;
 FOR image IN SELECT DISTINCT jsonb_array_elements_text(p_data->'image_urls') LOOP
  IF EXISTS(SELECT 1 FROM public.inspection_images WHERE inspection_id=result.id AND url=image) THEN CONTINUE; END IF;
  image_path:=split_part(image,'path=',2);
  IF image NOT LIKE '/api/store-ops/media?path=shelf-inspection/%' OR split_part(image_path,'/',2)<>auth.uid()::text OR image_path LIKE '%..%' THEN RAISE EXCEPTION 'Invalid inspection photo'; END IF;
  INSERT INTO public.inspection_images(inspection_id,url,created_by) VALUES(result.id,image,auth.uid());
 END LOOP;
 RETURN to_jsonb(result);
END $$;
REVOKE ALL ON FUNCTION public.store_ops_shelf_save(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.store_ops_shelf_save(uuid,jsonb) TO authenticated;
COMMIT;
