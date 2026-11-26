'use server'

import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/store-ops/permissions';
import { operationsContext, operationError } from '@/lib/store-ops/context';
import { incidentSchema, validationMessage } from '@/lib/store-ops/validation';
import { uploadOperationsImage, removeOperationsImages } from '@/lib/store-ops/uploads';
import type { Database, Json } from '@/lib/supabase/database.types';

export async function uploadIncidentVoice(form: FormData) {
  try {
    const {supabase,user}=await operationsContext('incidents.create');
    const file=form.get('file');
    if(!(file instanceof File)||!file.size||file.size>5*1024*1024)throw new Error('Choose an audio file smaller than 5 MB.');
    const allowed: Record<string,string>={'audio/webm':'webm','audio/ogg':'ogg','audio/mp4':'m4a','audio/mpeg':'mp3','audio/wav':'wav'};
    const ext=allowed[file.type];if(!ext)throw new Error('Choose a WebM, Ogg, M4A, MP3 or WAV recording.');
    const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
    const header=String.fromCharCode(...bytes);
    const valid=ext==='webm'?bytes[0]===0x1a&&bytes[1]===0x45:ext==='ogg'?header.startsWith('OggS'):ext==='m4a'?header.slice(4,8)==='ftyp':ext==='wav'?header.startsWith('RIFF')&&header.slice(8,12)==='WAVE':header.startsWith('ID3')||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0);
    if(!valid)throw new Error('This recording has an invalid audio format.');
    const path=`incidents/${user.id}/${crypto.randomUUID()}.${ext}`;
    const {error}=await supabase.storage.from('store-images').upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw new Error('Voice note could not be uploaded.');return {success:true,error:undefined,url:`/api/store-ops/media?path=${path}`};
  }catch(error){return {...operationError(error),url:undefined};}
}

async function saveIncident(id:string|null,input:unknown) {
  const parsed=incidentSchema.safeParse(input);if(!parsed.success)return operationError(new Error(validationMessage(parsed.error)));
  try {const {supabase}=await operationsContext(id?'incidents.edit':'incidents.create');
    const prior=id?await supabase.from('incident_images').select('url').eq('incident_id',id):null;
    const {data,error}=await supabase.rpc('store_ops_incident_save',{p_id:id,p_data:{...parsed.data,image_urls:parsed.data.image_urls||[]} as Json});
    if(error||!data||typeof data!=='object'||Array.isArray(data)||typeof data.id!=='string')throw new Error(error?.message||'Incident was not saved.');
    await removeOperationsImages((prior?.data||[]).filter(image=>!parsed.data.image_urls?.includes(image.url)).map(image=>image.url));
    return {success:true,error:undefined,data:data as unknown as Database['public']['Tables']['incidents']['Row']};
  }catch(error){return operationError(error);}
}
export async function createIncident(input:unknown){return saveIncident(null,input);}
export async function updateIncident(id:string,input:unknown){return saveIncident(id,input);}

export async function deleteIncident(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'incidents.delete')) {
    return { error: 'Forbidden' };
  }

  const {data:incident}=await supabase.from('incidents').select('voice_note_url').eq('id',id).single();
  const { data: images } = await supabase
    .from('incident_images')
    .select('url')
    .eq('incident_id', id);

  const { data: changed, error } = await supabase
    .from('incidents')
    .delete()
    .eq('id', id).select('id').single();

  if(error||!changed)return {error:error?.message||'Incident was not changed.'};
  await removeOperationsImages([...(images||[]).map(image=>image.url),...(incident?.voice_note_url?[incident.voice_note_url]:[])]);
  return { success: true };
}

export async function updateIncidentStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'incidents.change_status')) {
    return { error: 'Forbidden' };
  }

  const { data: changed, error } = await supabase
    .from('incidents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id).select('id').single();

  if(error||!changed)return {error:error?.message||'Incident was not changed.'};
  return { success: true };
}

export async function assignIncident(id: string, assigneeId: string | null) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'incidents.assign')) {
    return { error: 'Forbidden' };
  }

  const { data: changed, error } = await supabase
    .from('incidents')
    .update({ assigned_to: assigneeId, updated_at: new Date().toISOString() })
    .eq('id', id).select('id').single();

  if(error||!changed)return {error:error?.message||'Incident was not changed.'};
  return { success: true };
}

export async function addIncidentComment(incidentId: string, comment: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !can(profile.role, 'incidents.add_comment')) {
    return { error: 'Forbidden' };
  }

  const { data, error } = await supabase
    .from('incident_comments')
    .insert({
      incident_id: incidentId,
      comment,
      created_by: user.id,
    })
    .select('*, profiles:profiles!created_by(full_name)')
    .single();

  if (error) return { error: error.message };
  return { success: true, data };
}

export async function uploadIncidentImage(form:FormData){return uploadOperationsImage(form,'incidents');}

export async function deleteIncidentImage(imageId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data: image } = await supabase
    .from('incident_images')
    .select('url')
    .eq('id', imageId)
    .single();

  if (!image) return { error: 'Image not found' };

  const { error } = await supabase
    .from('incident_images')
    .delete()
    .eq('id', imageId);

  if (error) return { error: error.message };
  await removeOperationsImages([image.url]);
  return { success: true };
}
