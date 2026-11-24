-- Read-only authorized staging checks. No raw device keys or message bodies.
SELECT n.nspname,p.proname,p.prosecdef,p.proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE p.proname IN ('attendance_notification_user','attendance_reminder_admin','attendance_reminder_worker','reminder_eligibility','protect_attendance_notification') ORDER BY n.nspname,p.proname;
SELECT role_name,
 has_function_privilege(role_name,'public.attendance_notification_user(jsonb)','EXECUTE') AS user_rpc,
 has_function_privilege(role_name,'public.attendance_reminder_worker(jsonb)','EXECUTE') AS worker_rpc,
 has_table_privilege(role_name,'hrm_private.attendance_notification_keys','SELECT') AS raw_credentials
FROM (VALUES('anon'),('authenticated'),('service_role')) AS roles(role_name);
SELECT relname,relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','hrm_private') AND relname IN ('attendance_reminder_settings','attendance_notification_preferences','attendance_notification_devices','attendance_notification_keys','attendance_reminder_jobs','attendance_push_deliveries');
SELECT schemaname,tablename,policyname,permissive,roles,cmd FROM pg_policies WHERE tablename='notification_log';
SELECT store_id,enabled,last_planned_at FROM attendance_reminder_settings;
SELECT status,count(*) FROM hrm_private.attendance_push_deliveries GROUP BY status;
SELECT pubname,schemaname,tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='notification_log';
