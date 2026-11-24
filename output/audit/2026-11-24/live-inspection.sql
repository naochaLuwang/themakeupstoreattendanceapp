-- READ ONLY. Run through authorized read-only PostgreSQL access, not the app.
-- Do not execute business functions or change production rows during assessment.
-- Results may describe sensitive security configuration; keep them private.

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY schemaname, tablename, policyname;

SELECT grantee, table_schema, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema IN ('public', 'storage')
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_schema, table_name, grantee, privilege_type;

SELECT table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='profiles'
ORDER BY column_name, grantee, privilege_type;

SELECT ns.nspname AS schema_name, cl.relname AS table_name,
       co.conname, pg_get_constraintdef(co.oid) AS definition
FROM pg_constraint co
JOIN pg_class cl ON cl.oid=co.conrelid
JOIN pg_namespace ns ON ns.oid=cl.relnamespace
WHERE ns.nspname='public'
ORDER BY cl.relname, co.conname;

SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname='public'
ORDER BY tablename, indexname;

SELECT ns.nspname AS schema_name, cl.relname AS table_name,
       tr.tgname, pg_get_triggerdef(tr.oid) AS definition
FROM pg_trigger tr
JOIN pg_class cl ON cl.oid=tr.tgrelid
JOIN pg_namespace ns ON ns.oid=cl.relnamespace
WHERE NOT tr.tgisinternal AND ns.nspname='public'
ORDER BY cl.relname, tr.tgname;

SELECT ns.nspname, pr.proname, pg_get_function_identity_arguments(pr.oid) AS arguments,
       pr.prosecdef AS security_definer, pr.proconfig, pr.proacl,
       pg_get_functiondef(pr.oid) AS definition
FROM pg_proc pr JOIN pg_namespace ns ON ns.oid=pr.pronamespace
WHERE ns.nspname='public' AND pr.prokind='f'
ORDER BY pr.proname;

SELECT pubname, schemaname, tablename
FROM pg_publication_tables WHERE schemaname='public'
ORDER BY pubname, tablename;

SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets ORDER BY id;

-- Existence only; cron schedules/Auth dashboard settings need separately
-- authorized read-only inspection. No job or checkout RPC is invoked here.
SELECT to_regclass('cron.job') AS cron_catalog,
       to_regclass('supabase_migrations.schema_migrations') AS migration_catalog;
