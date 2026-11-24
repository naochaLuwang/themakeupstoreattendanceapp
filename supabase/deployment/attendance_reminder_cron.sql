-- OPERATOR-REVIEWED SETUP ONLY. Not a migration; never installs automatically.
-- Required Vault secrets:
-- attendance_reminder_worker_url = https://YOUR-HOST/api/internal/attendance-reminders/run
-- attendance_reminder_worker_secret = same random secret as server ATTENDANCE_REMINDER_WORKER_SECRET
-- Enable pg_cron, pg_net and Vault in authorized staging before using this file.
DO $$ BEGIN
 IF to_regprocedure('cron.schedule(text,text,text)') IS NULL OR to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
  RAISE EXCEPTION 'Configure Supabase Cron and pg_net before installing the reminder schedule'; END IF;
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='attendance_reminder_worker_url' AND decrypted_secret~'^https://[^[:space:]]+/api/internal/attendance-reminders/run$')
 OR NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='attendance_reminder_worker_secret' AND length(decrypted_secret)>=32) THEN
  RAISE EXCEPTION 'Set the worker HTTPS URL and secret in Vault first'; END IF;
END $$;
SELECT cron.schedule('hrm-attendance-reminders','* * * * *',$job$
 SELECT net.http_post(
  url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='attendance_reminder_worker_url' LIMIT 1),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='attendance_reminder_worker_secret' LIMIT 1)),
  body:='{}'::jsonb,timeout_milliseconds:=55000
 );
$job$);
-- To withdraw this schedule, as an authorized operator:
-- SELECT cron.unschedule('hrm-attendance-reminders');
-- Leave unrelated schedules and attendance data untouched.
