export const DAMAGE_TYPES = [
  'Broken', 'Leaking', 'Expired', 'Packaging Damage',
  'Customer Damage', 'Supplier Damage', 'Missing Item', 'Tester Finished'
] as const;

export const DAMAGE_REPORT_STATUSES = ['pending', 'approved', 'rejected', 'archived'] as const;

export const CHECKLIST_TYPES = ['opening', 'closing'] as const;

export const CHECKLIST_STATUSES = ['in_progress', 'completed', 'missed'] as const;

export const DEFAULT_OPENING_ITEMS = [
  'Unlock Store',
  'Count Cash',
  'Switch Lights On',
  'Clean Mirrors',
  'Arrange Displays',
  'Sanitize Testers',
  'Open POS System',
  'Check Inventory Alerts',
  'Sweep & Mop Floor',
  'Turn On Music',
] as const;

export const DEFAULT_CLOSING_ITEMS = [
  'Lock Cabinets',
  'Count Cash & Reconcile',
  'Turn Off Lights',
  'Upload Day Photos',
  'Lock Store',
  'Close POS System',
  'Sweep & Mop Floor',
  'Turn Off Music',
  'Set Alarm',
] as const;

export const INSPECTION_STATUSES = ['good','needs_restock','dirty','wrong_display','missing_tester','missing_price_tag','damaged_display'] as const;

export const TESTER_CONDITIONS = ['good','fair','poor','finished'] as const;

export const TASK_PRIORITIES = ['low','medium','high','urgent'] as const;
export const TASK_STATUSES = ['pending','in_progress','completed','cancelled'] as const;
export const TASK_CATEGORIES = ['restock','cleaning','inventory','maintenance','promotion','general'] as const;

export const AUDIT_CATEGORIES = ['display','cleanliness','staff','lighting','product_placement','price_tags','promotions','safety'] as const;
export const AUDIT_STATUSES = ['in_progress','completed'] as const;

export const INCIDENT_TYPES = ['customer_complaint','power_failure','internet_down','theft','broken_fixture','emergency','medical','other'] as const;
export const INCIDENT_PRIORITIES = ['low','medium','high','urgent'] as const;
export const INCIDENT_STATUSES = ['open','in_progress','resolved','closed'] as const;

export const RESTOCK_STATUSES = ['pending','approved','rejected','completed'] as const;
