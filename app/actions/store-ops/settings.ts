'use server';
import { z } from 'zod';
import { operationsContext, operationError } from '@/lib/store-ops/context';
import { uuid } from '@/lib/store-ops/validation';

export async function saveOperationsSettings(input:unknown) {
    try {
        const data=z.object({store_id:uuid,enabled:z.boolean(),opening_due:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),closing_due:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),audit_due_days:z.number().int().min(1).max(365),tester_notice_days:z.number().int().min(1).max(90),expected_updated_at:z.string().nullable()}).parse(input);
        const{supabase,user,profile}=await operationsContext();if(profile.role!=='admin'&&profile.role!=='manager')throw new Error('Manager permission required.');
        const{expected_updated_at,...settings}=data;
        if(expected_updated_at){const{data:changed,error}=await supabase.from('store_operations_settings').update(settings).eq('store_id',settings.store_id).eq('updated_at',expected_updated_at).select('id').single();if(error||!changed)throw new Error('Settings changed elsewhere. Refresh and retry.');}
        else{const{error}=await supabase.from('store_operations_settings').insert({...settings,created_by:user.id});if(error)throw new Error('Settings could not be saved. Refresh and retry.');}
        return {success:true,error:undefined};
    }catch(error){return operationError(error);}
}
