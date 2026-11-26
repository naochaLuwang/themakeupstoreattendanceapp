"""Disposable PostgreSQL with fictional staff only; never reads environment files."""
from contextlib import contextmanager
from pathlib import Path
import json
import shutil
import subprocess
import sys
import tempfile

sys.dont_write_bytecode = True
from attendance_fixture import BASE_SCHEMA

ROOT = Path(__file__).resolve().parents[1]
BIN = Path('/opt/homebrew/opt/postgresql@17/bin')


@contextmanager
def database(migration_names=None):
    directory = Path(tempfile.mkdtemp(prefix='store-ops-tests-', dir='/private/tmp'))
    started = False
    def command(name, *args):
        return subprocess.run([str(BIN/name), *args], capture_output=True, text=True)
    def sql(statement, actor=None, role='authenticated', error=None):
        if actor:
            statement = f"SET ROLE {role}; SELECT set_config('request.jwt.claim.sub','{actor}',false); " + statement
        elif role == 'anon':
            statement = 'SET ROLE anon; ' + statement
        result = command('psql', '-X', '-qAt', '-h', str(directory), '-p', '55447', '-U', 'ops_test', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', statement)
        if error:
            assert result.returncode and error in result.stderr, result.stderr or result.stdout
            return result.stderr
        assert result.returncode == 0, result.stderr
        return result.stdout.strip().splitlines()[-1] if result.stdout.strip() else ''
    try:
        result = command('initdb', '-D', str(directory/'data'), '-A', 'trust', '-U', 'ops_test', '--no-locale', '-E', 'UTF8')
        assert result.returncode == 0, result.stderr
        result = command('pg_ctl', '-D', str(directory/'data'), '-l', str(directory/'server.log'), '-o', f"-h '' -k {directory} -p 55447 -c wal_level=logical", '-w', 'start')
        assert result.returncode == 0, result.stderr
        started = True
        sql('CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;')
        sql(BASE_SCHEMA)
        sql("""CREATE SCHEMA storage;
        CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
        CREATE TABLE storage.objects(id uuid DEFAULT gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
        GRANT USAGE ON SCHEMA storage TO authenticated,anon;
        GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;
        CREATE PUBLICATION supabase_realtime;""")
        migrations = sorted((ROOT/'supabase/migrations').glob('*.sql')) if migration_names is None else [ROOT/'supabase/migrations'/name for name in migration_names]
        for migration in migrations:
            result = command('psql', '-X', '-qAt', '-h', str(directory), '-p', '55447', '-U', 'ops_test', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', str(migration))
            assert result.returncode == 0, migration.name + '\n' + result.stderr[-2500:]
        yield sql
    finally:
        if started:
            command('pg_ctl', '-D', str(directory/'data'), '-m', 'fast', '-w', 'stop')
        shutil.rmtree(directory)


def literal(data):
    return "'" + json.dumps(data).replace("'", "''") + "'::jsonb"
