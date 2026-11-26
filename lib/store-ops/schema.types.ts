type TemplateItem = { id: string; template_id: string; label: string; sort_order: number; is_required: boolean; requires_photo: boolean; is_active: boolean; created_at: string; updated_at: string; created_by: string };
type Table<R, K extends keyof R> = { Row: R; Insert: Pick<R,K> & Partial<Omit<R,K>>; Update: Partial<R>; Relationships: [] };
type Metadata = {id:string;created_at:string;updated_at:string;created_by:string};
export type OperationsTables = {
    store_operation_events: Table<Metadata & {store_id:string|null;record_type:string;record_id:string;action:string;previous_values:import('@/lib/supabase/database.types').Json;next_values:import('@/lib/supabase/database.types').Json},'record_type'|'record_id'|'action'|'created_by'>;
    store_operations_settings: Table<Metadata & {store_id:string;enabled:boolean;opening_due:string;closing_due:string;audit_due_days:number;tester_notice_days:number},'store_id'|'created_by'>;
    store_operation_preferences: Table<Metadata & {user_id:string;enabled:boolean;push_enabled:boolean},'user_id'|'created_by'>;
    checklist_template_items: {
        Row: TemplateItem;
        Insert: Pick<TemplateItem, 'template_id' | 'label' | 'created_by'> & Partial<TemplateItem>;
        Update: Partial<TemplateItem>;
        Relationships: [{ foreignKeyName: 'checklist_template_items_template_id_fkey'; columns: ['template_id']; referencedRelation: 'checklist_templates'; referencedColumns: ['id'] }];
    };
};
