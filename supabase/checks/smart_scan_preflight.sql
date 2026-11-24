-- Read-only, for an authorized staging clone after the attendance preflight.
-- No token values, coordinates, credentials or personal records are selected.
SELECT n.nspname,p.proname,p.prosecdef,p.proconfig
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname='public' AND p.proname='attendance_smart_scan')
 OR (n.nspname='hrm_private' AND p.proname IN ('attendance_smart_scan','smart_location','attendance_transition','attendance_audit_write'))
ORDER BY n.nspname,p.proname;
SELECT role_name,
 has_function_privilege(role_name,'public.attendance_smart_scan(jsonb,uuid)','EXECUTE') AS can_scan,
 has_table_privilege(role_name,'hrm_private.attendance_qr_attempts','SELECT') AS can_read_attempts,
 has_table_privilege(role_name,'hrm_private.attendance_qr_operations','SELECT') AS can_read_receipts
FROM (VALUES('anon'),('authenticated')) AS roles(role_name);
SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='hrm_private' AND c.relname IN ('attendance_qr_attempts','attendance_qr_operations');
SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid='public.attendance_policies'::regclass AND conname='smart_qr_requires_engine';
SELECT store_id,enforce_engine,smart_qr_enabled,require_location_metadata,require_session_binding
FROM public.attendance_policies ORDER BY store_id;
