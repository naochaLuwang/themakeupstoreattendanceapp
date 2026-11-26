BEGIN;
CREATE OR REPLACE FUNCTION public.store_ops_audit_template(p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE template public.audit_templates; question jsonb; position integer:=0;
BEGIN
 IF NOT store_ops_private.manager() THEN RAISE EXCEPTION 'Manager permission required' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(p_data->>'name'),'') IS NULL OR jsonb_typeof(p_data->'questions')<>'array' OR jsonb_array_length(p_data->'questions') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Add a name and 1–100 audit questions'; END IF;
 INSERT INTO public.audit_templates(name,category,store_id,created_by) VALUES(btrim(p_data->>'name'),p_data->>'category',(p_data->>'store_id')::uuid,auth.uid()) RETURNING * INTO template;
 FOR question IN SELECT jsonb_array_elements(p_data->'questions') LOOP
  IF nullif(btrim(question->>'question'),'') IS NULL OR (question->>'max_score')::integer NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid audit question'; END IF;
  INSERT INTO public.audit_questions(template_id,question,max_score,sort_order,created_by) VALUES(template.id,btrim(question->>'question'),(question->>'max_score')::integer,position,auth.uid()); position:=position+1;
 END LOOP;
 RETURN to_jsonb(template);
END $$;
CREATE OR REPLACE FUNCTION public.store_ops_audit_start(p_template uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE template public.audit_templates; audit public.audits; total integer;
BEGIN
 IF NOT store_ops_private.manager() THEN RAISE EXCEPTION 'Manager permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO template FROM public.audit_templates WHERE id=p_template;
 IF NOT FOUND THEN RAISE EXCEPTION 'Audit template unavailable'; END IF;
 SELECT sum(max_score) INTO total FROM public.audit_questions WHERE template_id=template.id;
 IF total IS NULL OR total<1 OR total>999 THEN RAISE EXCEPTION 'Add questions with a total maximum score of 1–999'; END IF;
 INSERT INTO public.audits(template_id,store_id,conducted_by,max_score,created_by) VALUES(template.id,template.store_id,auth.uid(),total,auth.uid()) RETURNING * INTO audit;
 INSERT INTO public.audit_answers(audit_id,question_id,score,created_by) SELECT audit.id,id,0,auth.uid() FROM public.audit_questions WHERE template_id=template.id;
 RETURN to_jsonb(audit);
END $$;
CREATE OR REPLACE FUNCTION store_ops_private.audit_completion() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE total numeric; maximum numeric; unanswered integer;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.status='completed' THEN RAISE EXCEPTION 'Completed audits are retained as history'; END IF;
  IF NEW.template_id IS DISTINCT FROM OLD.template_id OR NEW.conducted_by IS DISTINCT FROM OLD.conducted_by OR NEW.max_score IS DISTINCT FROM OLD.max_score THEN RAISE EXCEPTION 'Audit identity cannot change'; END IF;
 END IF;
 IF NEW.status='completed' THEN
  SELECT sum(a.score),sum(q.max_score),count(*) FILTER(WHERE a.answered_at IS NULL) INTO total,maximum,unanswered
   FROM public.audit_answers a JOIN public.audit_questions q ON q.id=a.question_id WHERE a.audit_id=NEW.id;
  IF total IS NULL OR maximum<>NEW.max_score OR unanswered>0 THEN RAISE EXCEPTION 'Save every audit answer before completing'; END IF;
  NEW.final_score:=total;
 ELSIF NEW.final_score IS NOT NULL THEN RAISE EXCEPTION 'Final score is calculated when the audit is completed'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION store_ops_private.audit_completion() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ops_audit_completion BEFORE INSERT OR UPDATE ON public.audits FOR EACH ROW EXECUTE FUNCTION store_ops_private.audit_completion();
REVOKE ALL ON FUNCTION public.store_ops_audit_template(jsonb),public.store_ops_audit_start(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.store_ops_audit_template(jsonb),public.store_ops_audit_start(uuid) TO authenticated;
COMMIT;
