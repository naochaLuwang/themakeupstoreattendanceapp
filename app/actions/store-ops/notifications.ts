'use server';
import {operationsContext,operationError} from '@/lib/store-ops/context';
import { attendanceNotificationFilter, type NotificationScope } from '@/lib/notifications/feed';
export async function getNotifications(userId:string) {
    try {const{supabase,user}=await operationsContext();if(userId!==user.id)throw new Error('Notifications belong to another account.');
        const{data,error}=await supabase.from('notification_log').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);if(error)throw new Error('Notifications could not be loaded.');return {data:data||[],error:undefined};
    }catch(error){return {...operationError(error),data:[]};}
}
export async function markAsRead(id:string) {
    try {const{supabase,user}=await operationsContext();const{data,error}=await supabase.from('notification_log').update({is_read:true}).eq('id',id).eq('user_id',user.id).select('id').single();if(error||!data)throw new Error('Notification could not be marked read.');return {success:true,error:undefined};}
    catch(error){return operationError(error);}
}
export async function markAllAsRead(userId:string,scope:NotificationScope='all') {
    try {const{supabase,user}=await operationsContext();if(userId!==user.id)throw new Error('Notifications belong to another account.');if(!['all','attendance','operations'].includes(scope))throw new Error('Invalid notification filter.');let query=supabase.from('notification_log').update({is_read:true}).eq('user_id',user.id).eq('is_read',false);if(scope==='attendance')query=query.or(attendanceNotificationFilter);if(scope==='operations')query=query.like('type','ops_%');const{error}=await query;if(error)throw new Error('Notifications could not be marked read.');return {success:true,error:undefined};}
    catch(error){return operationError(error);}
}
export async function getOperationsNotificationPreference(userId:string) {
    try {const{supabase,user}=await operationsContext();if(userId!==user.id)throw new Error('Your account changed. Refresh notification settings.');const{data,error}=await supabase.from('store_operation_preferences').select('enabled,push_enabled').eq('user_id',user.id).maybeSingle();if(error)throw new Error('Store notification preferences could not be loaded.');return {success:true as const,data:data||{enabled:true,push_enabled:false},error:undefined};}
    catch(error){return operationError(error);}
}
export async function saveOperationsNotificationPreference(enabled:boolean,pushEnabled:boolean,expectedUserId?:string) {
    try {const{supabase,user}=await operationsContext();if(expectedUserId!==undefined&&expectedUserId!==user.id)throw new Error('Your account changed. Refresh notification settings.');if(typeof enabled!=='boolean'||typeof pushEnabled!=='boolean')throw new Error('Invalid notification preferences.');const{error}=await supabase.from('store_operation_preferences').upsert({user_id:user.id,created_by:user.id,enabled,push_enabled:pushEnabled},{onConflict:'user_id'});if(error)throw new Error('Notification preferences could not be saved.');return {success:true,error:undefined};}
    catch(error){return operationError(error);}
}
