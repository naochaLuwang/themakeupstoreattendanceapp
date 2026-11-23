export type Role = 'admin' | 'manager' | 'employee';

export type Permission = 
  | 'damage_reports.create'
  | 'damage_reports.approve'
  | 'damage_reports.reject'
  | 'damage_reports.archive'
  | 'damage_reports.delete'
  | 'damage_reports.edit'
  | 'damage_reports.add_comment'
  | 'damage_reports.upload_image'
  | 'shelf_inspection.create'
  | 'shelf_inspection.approve'
  | 'shelf_inspection.edit'
  | 'shelf_inspection.delete'
  | 'shelf_inspection.add_comment'
  | 'shelf_inspection.upload_image'
  | 'tasks.create'
  | 'tasks.edit'
  | 'tasks.delete'
  | 'tasks.complete'
  | 'tasks.add_comment'
  | 'tasks.upload_attachment'
  | 'tasks.assign'
  | 'testers.create'
  | 'testers.edit'
  | 'testers.delete'
  | 'testers.log_action'
  | 'restock.create'
  | 'restock.approve'
  | 'restock.reject'
  | 'restock.complete'
  | 'restock.delete'
  | 'incidents.create'
  | 'incidents.edit'
  | 'incidents.delete'
  | 'incidents.add_comment'
  | 'incidents.upload_image'
  | 'incidents.assign'
  | 'incidents.change_status';

const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    'damage_reports.create',
    'damage_reports.approve',
    'damage_reports.reject',
    'damage_reports.archive',
    'damage_reports.delete',
    'damage_reports.edit',
    'damage_reports.add_comment',
    'damage_reports.upload_image',
    'shelf_inspection.create',
    'shelf_inspection.approve',
    'shelf_inspection.edit',
    'shelf_inspection.delete',
    'shelf_inspection.add_comment',
    'shelf_inspection.upload_image',
    'tasks.create',
    'tasks.edit',
    'tasks.delete',
    'tasks.complete',
    'tasks.add_comment',
    'tasks.upload_attachment',
    'tasks.assign',
    'testers.create',
    'testers.edit',
    'testers.delete',
    'testers.log_action',
    'restock.create',
    'restock.approve',
    'restock.reject',
    'restock.complete',
    'restock.delete',
    'incidents.create',
    'incidents.edit',
    'incidents.delete',
    'incidents.add_comment',
    'incidents.upload_image',
    'incidents.assign',
    'incidents.change_status',
  ],
  manager: [
    'damage_reports.create',
    'damage_reports.approve',
    'damage_reports.reject',
    'damage_reports.archive',
    'damage_reports.edit',
    'damage_reports.add_comment',
    'damage_reports.upload_image',
    'shelf_inspection.create',
    'shelf_inspection.approve',
    'shelf_inspection.edit',
    'shelf_inspection.add_comment',
    'shelf_inspection.upload_image',
    'tasks.create',
    'tasks.edit',
    'tasks.complete',
    'tasks.add_comment',
    'tasks.upload_attachment',
    'tasks.assign',
    'testers.create',
    'testers.edit',
    'testers.log_action',
    'restock.create',
    'restock.approve',
    'restock.reject',
    'restock.complete',
    'incidents.create',
    'incidents.edit',
    'incidents.add_comment',
    'incidents.upload_image',
    'incidents.assign',
    'incidents.change_status',
  ],
  employee: [
    'damage_reports.create',
    'damage_reports.add_comment',
    'damage_reports.upload_image',
    'shelf_inspection.create',
    'shelf_inspection.add_comment',
    'shelf_inspection.upload_image',
    'tasks.complete',
    'tasks.add_comment',
    'tasks.upload_attachment',
    'testers.log_action',
    'restock.create',
    'incidents.create',
    'incidents.add_comment',
    'incidents.upload_image',
  ],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const permissions = rolePermissions[role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function canManageApprovals(role: Role | null | undefined): boolean {
  return role === 'admin' || role === 'manager';
}

export function canDelete(role: Role | null | undefined): boolean {
  return role === 'admin';
}
