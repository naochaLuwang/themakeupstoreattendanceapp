import 'server-only';
import { z } from 'zod';
import { createServiceClient } from '@/lib/admin-client';
import { createNotificationDispatcher } from '@/lib/notifications/providers';
import type { Json } from '@/lib/supabase/database.types';
import type { AuthorizedDelivery } from '@/lib/notifications/types';

export async function runOperationsWorker() {
    const client = createServiceClient();
    const dispatch = createNotificationDispatcher();
    async function command(value: Record<string, Json | undefined>) {
        const { data, error } = await client.rpc('store_ops_worker', { p_command: value });
        if (error || !data) throw new Error('Operations worker could not confirm its database update.');
        return data;
    }
    await command({ action: 'plan' });
    const { items } = z.object({ items: z.array(z.object({ id: z.uuid(), leaseToken: z.uuid() })) }).parse(await command({ action: 'claim' }));
    const counts = { claimed: items.length, sent: 0, retry: 0, failed: 0, suppressed: 0 };
    for (let start = 0; start < items.length; start += 3) {
        await Promise.all(items.slice(start, start + 3).map(async item => {
            try {
                const raw = await command({ action: 'authorize', deliveryId: item.id, leaseToken: item.leaseToken });
                const schema = z.discriminatedUnion('allowed', [z.object({ allowed: z.literal(false) }), z.object({ allowed: z.literal(true), provider: z.literal('fcm'), category: z.literal('operations'), credential: z.unknown(), expiresAt: z.string(), notificationId: z.uuid(), url: z.string() })]);
                const authorized = schema.parse(raw);
                if (!authorized.allowed) { counts.suppressed++; return; }
                const result = await dispatch(authorized as Extract<AuthorizedDelivery, { allowed: true }>);
                await command({ action: 'finish', deliveryId: item.id, leaseToken: item.leaseToken, ...result });
                if (result.outcome === 'sent') counts.sent++;
                else if (result.outcome === 'retry' || result.outcome === 'blocked_configuration') counts.retry++;
                else counts.failed++;
            } catch { counts.failed++; }
        }));
    }
    return counts;
}
