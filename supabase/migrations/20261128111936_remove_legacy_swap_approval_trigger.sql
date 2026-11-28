-- The legacy trigger rewrites shift ownership for every approved request,
-- including attendance re-entry. Current approval RPCs apply validated changes.
BEGIN;
DO $$
DECLARE legacy_trigger record;
BEGIN
  IF to_regprocedure('public.commit_shift_changes(jsonb,jsonb,uuid,text)') IS NULL
     OR to_regprocedure('public.attendance_transition(jsonb,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Install the shift and attendance approval migrations before this repair';
  END IF;

  FOR legacy_trigger IN
    SELECT t.tgname
    FROM pg_catalog.pg_trigger t
    WHERE t.tgrelid = 'public.swap_requests'::regclass
      AND t.tgfoid = to_regprocedure('public.handle_swap_approval()')
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER %I ON public.swap_requests', legacy_trigger.tgname);
  END LOOP;
END;
$$;
COMMIT;
