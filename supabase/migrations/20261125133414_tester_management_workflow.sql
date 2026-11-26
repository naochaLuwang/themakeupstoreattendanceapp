BEGIN;
ALTER TABLE public.testers ADD CONSTRAINT tester_expiry_after_open CHECK(opened_date IS NULL OR expiry_date IS NULL OR expiry_date>=opened_date) NOT VALID;
CREATE OR REPLACE FUNCTION store_ops_private.tester_history() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO public.tester_logs(tester_id,action,notes,created_by) VALUES(NEW.id,'created','Tester registered',NEW.created_by);
 ELSIF (to_jsonb(NEW)-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at') THEN
  INSERT INTO public.tester_logs(tester_id,action,notes,created_by) VALUES(NEW.id,'updated',
   format('Condition: %s; remaining: %s%%; replacement: %s',NEW.condition,NEW.remaining_percentage,NEW.needs_replacement),coalesce(auth.uid(),NEW.created_by));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION store_ops_private.tester_history() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS ops_tester_history ON public.testers;
CREATE TRIGGER ops_tester_history AFTER INSERT OR UPDATE ON public.testers FOR EACH ROW EXECUTE FUNCTION store_ops_private.tester_history();
COMMIT;
