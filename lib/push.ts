// lib/push.ts

import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;

webpush.setVapidDetails(
    'mailto:admin@themakeupstore.in',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

export async function sendPushNotification(title: string, body: string, url: string = '/') {
    const supabase = await createClient();

    // 1. Fetch all admin profiles
    const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

    if (!admins || admins.length === 0) return;

    const adminIds = admins.map(a => a.id);

    // 2. Fetch all push subscriptions for these admins
    const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .in('user_id', adminIds);

    if (!subscriptions || subscriptions.length === 0) return;

    const payload = JSON.stringify({ title, body, url });

    // 3. Send notifications in parallel
    const sendPromises = subscriptions.map(async (subRecord: any) => {
        try {
            await webpush.sendNotification(subRecord.subscription, payload);
        } catch (error: any) {
            console.error('Push failed for subscription:', error.endpoint, error.statusCode);
            // Optional: If error.statusCode is 410 or 404, the subscription is expired/invalid
            if (error.statusCode === 410 || error.statusCode === 404) {
                // Delete invalid subscription
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .match({ 'subscription->endpoint': subRecord.subscription.endpoint });
            }
        }
    });

    await Promise.allSettled(sendPromises);
}
