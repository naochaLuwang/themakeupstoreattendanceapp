-- Operator-reviewed setup, run after deploying the operations worker.
-- Requires pg_cron, pg_net, and Vault. This file is not an automatic migration.
-- Vault secrets:
-- store_operations_worker_url = https://YOUR-HOST/api/internal/store-operations/run
-- store_operations_worker_secret = server STORE_OPERATIONS_WORKER_SECRET (32+ random characters)
DO $$ BEGIN
 IF to_regprocedure('cron.schedule(text,text,text)') IS NULL OR to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NULL THEN
  RAISE EXCEPTION 'Configure Supabase Cron and pg_net before installing the operations schedule';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='store_operations_worker_url' AND decrypted_secret~'^https://[^[:space:]]+/api/internal/store-operations/run$')
 OR NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='store_operations_worker_secret' AND length(decrypted_secret)>=32) THEN
  RAISE EXCEPTION 'Set the operations worker HTTPS URL and secret in Vault first';
 END IF;
END $$;
SELECT cron.schedule('hrm-store-operations','* * * * *',$job$
 SELECT net.http_post(
  url:=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='store_operations_worker_url' LIMIT 1),
  headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='store_operations_worker_secret' LIMIT 1)),
  body:='{}'::jsonb,timeout_milliseconds:=55000
 );
$job$);
-- To withdraw only this schedule:
-- SELECT cron.unschedule('hrm-store-operations');
