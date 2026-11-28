-- Staff management. Serialize with existing attendance profile/branch authority changes.
BEGIN;

CREATE OR REPLACE FUNCTION public.set_employee_role(p_employee uuid, p_expected text, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    actor public.profiles%ROWTYPE;
    target public.profiles%ROWTYPE;
BEGIN
    PERFORM pg_catalog.pg_advisory_xact_lock(748913, 1);
    SELECT * INTO actor FROM public.profiles WHERE id = auth.uid();
    IF actor.role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Administrator access required.' USING ERRCODE = '42501';
    END IF;
    IF p_employee = actor.id THEN
        RAISE EXCEPTION 'Another admin must change your role.' USING ERRCODE = '42501';
    END IF;
    IF p_role IS NULL OR p_role NOT IN ('admin', 'employee') THEN
        RAISE EXCEPTION 'Choose Admin or Employee.' USING ERRCODE = '22023';
    END IF;
    SELECT * INTO target FROM public.profiles WHERE id = p_employee FOR UPDATE;
    IF NOT FOUND OR (actor.store_id IS NOT NULL AND actor.store_id IS DISTINCT FROM target.store_id) THEN
        RAISE EXCEPTION 'Employee unavailable in your store.' USING ERRCODE = '42501';
    END IF;
    IF target.role::text IS DISTINCT FROM p_expected THEN
        RAISE EXCEPTION 'This role has changed. Refresh and try again.' USING ERRCODE = 'P0001';
    END IF;
    target.role := p_role;
    UPDATE public.profiles SET role = target.role WHERE id = target.id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_employee_role(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_employee_role(uuid,text,text) TO authenticated;

-- Keep signed-in clients on the same guarded role-change path. Other profile edits
-- and trusted provisioning (service_role or the database owner) retain their grants.
CREATE OR REPLACE FUNCTION hrm_private.require_role_change_function()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF current_user IN ('anon', 'authenticated') THEN
        RAISE EXCEPTION 'Use employee management to change roles.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION hrm_private.require_role_change_function() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS hrm_staff_role_change ON public.profiles;
CREATE TRIGGER hrm_staff_role_change BEFORE UPDATE ON public.profiles
FOR EACH ROW WHEN (OLD.role IS DISTINCT FROM NEW.role)
EXECUTE FUNCTION hrm_private.require_role_change_function();

COMMIT;
