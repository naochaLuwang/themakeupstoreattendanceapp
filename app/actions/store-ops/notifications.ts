'use server'

import { createClient } from '@/lib/supabase/server';
import { sendPushNotification } from '@/lib/push';

export async function getNotifications(userId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { data, error } = await supabase
    .from('notification_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return { error: error.message, data: [] };
  return { data: data || [], error: null };
}

export async function markAsRead(notificationId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('notification_log')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  return { success: true };
}

export async function markAllAsRead(userId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('notification_log')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) return { error: error.message };
  return { success: true };
}

export async function createNotification(
  userId: string,
  title: string,
  body?: string,
  type?: string,
  link?: string
) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: 'Unauthorized' };

  const { error } = await supabase
    .from('notification_log')
    .insert({
      user_id: userId,
      title,
      body: body || null,
      type: type || null,
      link: link || null,
    });

  if (error) return { error: error.message };

  // Also send push notification
  await sendPushNotification(title, body || '', link || '/');

  return { success: true };
}
