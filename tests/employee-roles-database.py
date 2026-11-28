"""Exercise the employee directory role command on a disposable local database."""
import sys
sys.dont_write_bytecode = True

from attendance_fixture import ADMIN, EMP, MANAGER, OTHER, STORE
from store_ops_fixture import database

with database() as sql:
    def change(actor, target, previous, new, error=None):
        return sql(f"SELECT public.set_employee_role('{target}','{previous}','{new}')", actor=actor, error=error)

    for actor in (EMP, MANAGER):
        change(actor, OTHER, 'employee', 'admin', 'Administrator access required')
    change(ADMIN, ADMIN, 'admin', 'employee', 'Another admin')
    change(ADMIN, EMP, 'employee', 'manager', 'Choose Admin or Employee')
    change(ADMIN, EMP, 'employee', 'admin')
    assert sql(f"SELECT role FROM profiles WHERE id='{EMP}'") == 'admin'
    change(EMP, OTHER, 'employee', 'admin', 'unavailable in your store')
    change(EMP, ADMIN, 'admin', 'employee', 'unavailable in your store')
    change(EMP, MANAGER, 'manager', 'employee')
    change(EMP, MANAGER, 'manager', 'admin', 'role has changed')
    sql(f"UPDATE profiles SET role='admin' WHERE id='{OTHER}'", actor=EMP, error='Use employee management')
    change(ADMIN, EMP, 'admin', 'employee')
    change(EMP, MANAGER, 'employee', 'admin', 'Administrator access required')
    assert sql(f"SELECT store_id FROM profiles WHERE id='{EMP}'") == STORE
    sql(f"SELECT public.set_employee_role('{EMP}','employee','admin')", role='anon', error='permission denied')
    print('Employee promotions, demotions, legacy managers, branch scope, self-protection, stale changes and access checks passed.')
