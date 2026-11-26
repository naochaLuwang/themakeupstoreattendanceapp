'use server';
import {z} from 'zod';
import {operationsContext,operationError} from '@/lib/store-ops/context';
import {uuid} from '@/lib/store-ops/validation';
import type {Json} from '@/lib/supabase/database.types';
const itemsSchema=z.array(z.object({barcode:z.string().trim().min(1).max(100),product_name:z.string().trim().min(1).max(200),brand:z.string().trim().max(200).optional(),quantity_needed:z.number().int().min(1).max(100000),supplier_notes:z.string().max(2000).optional()})).min(1).max(100);
async function save(id:string|null,items:unknown,notes?:string,storeId?:string,supplierNotes?:string) {
    try {const checked=itemsSchema.parse(items);if(id)uuid.parse(id);if(storeId)uuid.parse(storeId);
        const {supabase}=await operationsContext(id?'restock.approve':'restock.create');
        const {data,error}=await supabase.rpc('store_ops_restock_save',{p_id:id,p_data:{items:checked,notes:notes?.trim().slice(0,5000)||null,store_id:storeId,supplier_notes:supplierNotes?.trim().slice(0,5000)||null} as Json});
        if(error)throw new Error(error.message);return {success:true,error:undefined,data};
    }catch(error){return operationError(error);}
}
export async function createRestockRequest(items:unknown,notes?:string,storeId?:string){return save(null,items,notes,storeId);}
export async function updateRestockRequest(id:string,items:unknown,notes?:string,supplierNotes?:string){return save(id,items,notes,undefined,supplierNotes);}
async function transition(id:string,status:'approved'|'rejected'|'completed') {
    try {const {supabase,user}=await operationsContext(status==='completed'?'restock.complete':status==='approved'?'restock.approve':'restock.reject');
        const {data,error}=await supabase.from('restock_requests').update({status,...(status!=='completed'?{approved_by:user.id,approved_at:new Date().toISOString()}: {})}).eq('id',uuid.parse(id)).eq('status',status==='completed'?'approved':'pending').select().single();
        if(error||!data)throw new Error(error?.message||'Request status changed. Refresh and retry.');return {success:true,error:undefined,data};
    }catch(error){return operationError(error);}
}
export async function approveRestockRequest(id:string){return transition(id,'approved');}
export async function rejectRestockRequest(id:string){return transition(id,'rejected');}
export async function completeRestockRequest(id:string){return transition(id,'completed');}
export async function deleteRestockRequest(id:string) {
    try {const {supabase}=await operationsContext('restock.delete');const {data,error}=await supabase.from('restock_requests').delete().eq('id',uuid.parse(id)).select('id').single();if(error||!data)throw new Error('Request was not deleted.');return {success:true,error:undefined};}
    catch(error){return operationError(error);}
}

export async function lookupOperationsBarcode(barcode:string) {
    const code=z.string().trim().min(1).max(100).parse(barcode);const {supabase}=await operationsContext();
    const [restocks,damages]=await Promise.all([supabase.from('restock_items').select('product_name,brand,barcode').eq('barcode',code).order('created_at',{ascending:false}).limit(1),supabase.from('damage_reports').select('product_name,brand,barcode').eq('barcode',code).order('created_at',{ascending:false}).limit(1)]);
    if(restocks.error||damages.error)throw new Error('Barcode lookup failed. Enter the product details manually.');return restocks.data?.[0]||damages.data?.[0]||null;
}
