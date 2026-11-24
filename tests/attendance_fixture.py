"""Shared fictional base schema for disposable local attendance database tests."""
EMP='00000000-0000-4000-8000-000000000001'
ADMIN='00000000-0000-4000-8000-000000000002'
OTHER='00000000-0000-4000-8000-000000000003'
MANAGER='00000000-0000-4000-8000-000000000004'
STORE='10000000-0000-4000-8000-000000000001'
FOREIGN='10000000-0000-4000-8000-000000000002'
SHIFT='20000000-0000-4000-8000-000000000001'
PRESET='30000000-0000-4000-8000-000000000001'
BASE_SCHEMA=f"""CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE TABLE stores(id uuid PRIMARY KEY,name text,lat double precision,lng double precision,radius_meters integer);
    CREATE TABLE profiles(id uuid PRIMARY KEY,role text,store_id uuid REFERENCES stores(id),hourly_rate numeric,full_name text);
    CREATE TABLE shifts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),employee_id uuid REFERENCES profiles(id),start_time timestamptz NOT NULL,end_time timestamptz,shift_label text,status text,created_at timestamptz DEFAULT now());
    CREATE TABLE attendance(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),employee_id uuid NOT NULL REFERENCES profiles(id),store_id uuid REFERENCES stores(id),shift_id uuid REFERENCES shifts(id),check_in timestamptz NOT NULL,check_out timestamptz,check_in_lat double precision,check_in_lng double precision,is_within_geofence boolean,is_auto_checkout boolean);
    CREATE TABLE swap_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),requestor_id uuid REFERENCES profiles(id),receiver_id uuid REFERENCES profiles(id),shift_id uuid REFERENCES shifts(id),message text,note text,status text,created_at timestamptz DEFAULT now());
    CREATE TABLE leave_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),employee_id uuid REFERENCES profiles(id),start_date date,end_date date,status text);
    CREATE TABLE shift_presets(id uuid PRIMARY KEY,label text,start_time time,end_time time);
    INSERT INTO stores VALUES('{STORE}','Test store',24.804,93.943,100),('{FOREIGN}','Other test store',0,0,100);
    INSERT INTO profiles VALUES('{EMP}','employee','{STORE}',100,'Test employee'),('{ADMIN}','admin',NULL,NULL,'Test admin'),('{OTHER}','employee','{FOREIGN}',100,'Other employee'),('{MANAGER}','manager','{STORE}',100,'Test manager');
    INSERT INTO shift_presets VALUES('{PRESET}','Day','10:00','18:00');
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    """
