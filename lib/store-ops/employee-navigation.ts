export const employeeOperationsRoot = '/employee/store-operations';

export const employeeOperationsModules = [
    { path: 'tasks', label: 'My tasks', description: 'Assigned work and due dates' },
    { path: 'daily-checklist', label: 'Daily checklist', description: 'Opening and closing routines' },
    { path: 'shelf-inspection', label: 'Shelf inspection', description: 'Check displays and shelf conditions' },
    { path: 'restocking', label: 'Restocking', description: 'Request products for your shelves' },
    { path: 'testers', label: 'Testers', description: 'Check condition and expiry' },
    { path: 'damage-reports', label: 'Damage reports', description: 'Record damaged products' },
    { path: 'incidents', label: 'Incidents', description: 'Report issues in the store' },
    { path: 'notifications', label: 'Notifications', description: 'Store alerts and preferences' },
] as const;

export type EmployeeOperationPath = typeof employeeOperationsModules[number]['path'];

export function activeEmployeeOperation(pathname: string) {
    return employeeOperationsModules.find(module => {
        const href = `${employeeOperationsRoot}/${module.path}`;
        return pathname === href || pathname.startsWith(`${href}/`);
    });
}
