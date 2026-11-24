import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import { createServiceClient } from '@/lib/admin-client';
import { createNotificationDispatcher } from './providers';
import { notificationReply } from './server';
import type { AuthorizedDelivery, DeliveryLease, DeliveryResult } from './types';

export async function runAttendanceReminders(options: { client?: SupabaseClient<Database>; deliver?: (payload: Extract<AuthorizedDelivery, { allowed: true }>) => Promise<DeliveryResult> } = {}) {
    const client = options.client || createServiceClient();
    const deliver = options.deliver || createNotificationDispatcher();
    async function command<T>(value: Record<string, Json | undefined>): Promise<T> {
        const { data, error } = await client.rpc('attendance_reminder_worker', { p_command: value as Json });
        const result = notificationReply<T>(data, error);
        if (!result.success) throw new Error('Reminder worker could not confirm a database operation.');
        return result.data;
    }
    const plan = await command<{ planned: number; busy?: boolean }>({ action: 'plan' });
    const { items } = await command<{ items: DeliveryLease[] }>({ action: 'claim' });
    const totals = { planned: plan.planned, claimed: items.length, sent: 0, retry: 0, blocked: 0, suppressed: 0, failed: 0 };
    // Bounded concurrency; no database locks are held during provider requests.
    for (let offset = 0; offset < items.length; offset += 3) {
        await Promise.allSettled(items.slice(offset, offset + 3).map(async lease => {
            try {
                const payload = await command<AuthorizedDelivery>({ action: 'authorize', deliveryId: lease.id, leaseToken: lease.leaseToken });
                if (!payload.allowed) { totals.suppressed++; return; }
                const outcome = await deliver(payload);
                await command({ action: 'finish', deliveryId: lease.id, leaseToken: lease.leaseToken, ...outcome });
                if (outcome.outcome === 'sent') totals.sent++;
                else if (outcome.outcome === 'retry') totals.retry++;
                else if (outcome.outcome === 'blocked_configuration') totals.blocked++;
                else totals.failed++;
            } catch { totals.failed++; /* Lease recovery handles interrupted/uncertain attempts. */ }
        }));
    }
    return totals;
}
