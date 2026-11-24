-- READ ONLY. Review on an authorized staging clone before installing 006.
SELECT current_database(),version();
SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('attendance','profiles','stores','shifts','swap_requests','leave_requests','payroll_records')
ORDER BY table_name,ordinal_position;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname='public' AND tablename IN ('attendance','profiles','stores','shifts','swap_requests','leave_requests','payroll_records');
SELECT event_object_table,trigger_name,action_timing,event_manipulation,action_statement FROM information_schema.triggers
WHERE event_object_schema='public' AND event_object_table IN ('attendance','profiles','stores','shifts','swap_requests');
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename IN ('attendance','shifts','profiles');
SELECT conrelid::regclass,conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN ('public.attendance'::regclass,'public.shifts'::regclass);
SELECT routine_name,grantee,privilege_type FROM information_schema.routine_privileges
WHERE routine_schema IN ('public','hrm_private') AND routine_name IN ('manual_trigger_checkout','commit_shift_changes','attendance_transition');
SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public'
AND table_name IN ('attendance','profiles','stores','payroll_records') AND grantee IN ('anon','authenticated','service_role');
SELECT p.oid::regprocedure,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN ('manual_trigger_checkout','attendance_transition');
-- Aggregate quality checks expose counts, not employee personal records.
SELECT count(*) AS employees_with_conflicting_open_sessions FROM (
 SELECT employee_id FROM public.attendance WHERE check_out IS NULL GROUP BY employee_id HAVING count(*)>1
) conflicts;
SELECT count(*) AS invalid_attendance_intervals FROM public.attendance WHERE check_out IS NOT NULL AND check_out<=check_in;
SELECT count(*) AS missing_store_coordinates FROM public.stores WHERE lat IS NULL OR lng IS NULL;
