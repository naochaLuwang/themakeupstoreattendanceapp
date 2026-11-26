BEGIN;
ALTER TABLE public.tasks ADD COLUMN recurrence_parent_id uuid UNIQUE REFERENCES public.tasks(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD CONSTRAINT task_title_nonempty CHECK(length(btrim(title)) BETWEEN 1 AND 200) NOT VALID;
CREATE OR REPLACE FUNCTION store_ops_private.next_recurring_task() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE step interval;
BEGIN
 IF NEW.status='completed' AND OLD.status<>'completed' AND NEW.is_recurring THEN
  step:=CASE NEW.recurrence_rule WHEN 'daily' THEN interval '1 day' WHEN 'weekly' THEN interval '1 week' WHEN 'monthly' THEN interval '1 month' ELSE NULL END;
  IF step IS NULL THEN RAISE EXCEPTION 'Choose daily, weekly, or monthly recurrence before completing this task'; END IF;
  INSERT INTO public.tasks(title,description,assigned_to,assigned_by,priority,due_date,status,category,is_recurring,recurrence_rule,store_id,created_by,recurrence_parent_id)
   VALUES(NEW.title,NEW.description,NEW.assigned_to,NEW.assigned_by,NEW.priority,greatest(coalesce(NEW.due_date,clock_timestamp()),clock_timestamp())+step,'pending',NEW.category,true,NEW.recurrence_rule,NEW.store_id,coalesce(auth.uid(),NEW.created_by),NEW.id)
   ON CONFLICT(recurrence_parent_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION store_ops_private.next_recurring_task() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER ops_next_task AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION store_ops_private.next_recurring_task();
COMMIT;
