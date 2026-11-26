BEGIN;
ALTER TABLE public.damage_reports ADD CONSTRAINT damage_quantity_positive CHECK(quantity>0) NOT VALID;
ALTER TABLE public.damage_reports ADD CONSTRAINT damage_mrp_positive CHECK(mrp IS NULL OR mrp>=0) NOT VALID;
CREATE OR REPLACE FUNCTION public.store_ops_damage_save(p_id uuid,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.damage_reports; image text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to continue' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(p_data->>'barcode'),'') IS NULL OR nullif(btrim(p_data->>'product_name'),'') IS NULL OR
  jsonb_typeof(p_data->'image_urls')<>'array' OR jsonb_array_length(p_data->'image_urls')>5 THEN RAISE EXCEPTION 'Invalid damage report'; END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.damage_reports(barcode,product_name,brand,shade,batch,mrp,quantity,damage_type,description,store_id,reported_by,created_by)
  VALUES(btrim(p_data->>'barcode'),btrim(p_data->>'product_name'),p_data->>'brand',p_data->>'shade',p_data->>'batch',
   (p_data->>'mrp')::numeric,(p_data->>'quantity')::integer,(p_data->>'damage_type')::public.damage_type,p_data->>'description',
   (p_data->>'store_id')::uuid,auth.uid(),auth.uid()) RETURNING * INTO result;
 ELSE
  IF NOT store_ops_private.manager() THEN RAISE EXCEPTION 'Manager permission required' USING ERRCODE='42501'; END IF;
  UPDATE public.damage_reports SET barcode=btrim(p_data->>'barcode'),product_name=btrim(p_data->>'product_name'),brand=p_data->>'brand',shade=p_data->>'shade',batch=p_data->>'batch',
   mrp=(p_data->>'mrp')::numeric,quantity=(p_data->>'quantity')::integer,damage_type=(p_data->>'damage_type')::public.damage_type,description=p_data->>'description',
   status='pending',reviewed_by=NULL,reviewed_at=NULL WHERE id=p_id AND status<>'archived' RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report unavailable, archived, or not authorized'; END IF;
  DELETE FROM public.damage_images WHERE damage_report_id=p_id AND url NOT IN(SELECT jsonb_array_elements_text(p_data->'image_urls'));
 END IF;
 FOR image IN SELECT DISTINCT jsonb_array_elements_text(p_data->'image_urls') LOOP
  IF EXISTS(SELECT 1 FROM public.damage_images WHERE damage_report_id=result.id AND url=image) THEN CONTINUE; END IF;
  IF image NOT LIKE '/api/store-ops/media?path=damage-reports/%' OR split_part(split_part(image,'path=',2),'/',2)<>auth.uid()::text OR image LIKE '%..%' THEN RAISE EXCEPTION 'Invalid damage photo'; END IF;
  INSERT INTO public.damage_images(damage_report_id,url,created_by) VALUES(result.id,image,auth.uid());
 END LOOP;
 RETURN to_jsonb(result);
END $$;
REVOKE ALL ON FUNCTION public.store_ops_damage_save(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.store_ops_damage_save(uuid,jsonb) TO authenticated;
COMMIT;
