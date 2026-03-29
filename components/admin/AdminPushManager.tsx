// components/admin/AdminPushManager.tsx
'use client';
import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

export default function AdminPushManager({ userId }: { userId: string }) {
    const supabase = createClient();
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkSubscription = async () => {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                setLoading(false);
                return;
            }

            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            setIsSubscribed(!!subscription);
            setLoading(false);
        };

        checkSubscription();
    }, []);

    const subscribe = async () => {
        try {
            setLoading(true);
            setError(null);

            const registration = await navigator.serviceWorker.ready;
            
            // 1. Request Permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error('Permission not granted for notifications.');
            }

            // 2. Subscribe to Push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: VAPID_PUBLIC_KEY
            });

            // 3. Save to Supabase
            const { error: dbError } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: userId,
                    subscription: subscription.toJSON()
                }, { onConflict: 'user_id, subscription->endpoint' });

            if (dbError) throw dbError;

            setIsSubscribed(true);
        } catch (err: any) {
            console.error('Subscription failed:', err);
            setError(err.message || 'Push registration failed.');
        } finally {
            setLoading(false);
        }
    };

    const unsubscribe = async () => {
        try {
            setLoading(true);
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                // Delete from DB first
                await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('user_id', userId)
                    .match({ 'subscription->endpoint': subscription.endpoint });

                await subscription.unsubscribe();
            }
            setIsSubscribed(false);
        } catch (err) {
            console.error('Unsubscribe failed:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !isSubscribed) return (
        <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-2xl animate-pulse">
            <Loader2 className="animate-spin text-slate-300" size={16} />
            <span className="text-[10px] font-black uppercase text-slate-300">Checking Push...</span>
        </div>
    );

    return (
        <div className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isSubscribed ? 'bg-emerald-50 text-emerald-500' : 'bg-slate-50 text-slate-400'}`}>
                        {isSubscribed ? <Bell size={18} /> : <BellOff size={18} />}
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Push Notifications</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                            {isSubscribed ? 'Active on this device' : 'Disabled'}
                        </p>
                    </div>
                </div>
                {isSubscribed && (
                    <ShieldCheck size={16} className="text-emerald-500" />
                )}
            </div>

            {error && (
                <p className="text-[9px] font-bold text-rose-500 bg-rose-50 p-2 rounded-lg text-center uppercase tracking-widest">
                    {error}
                </p>
            )}

            <button
                onClick={isSubscribed ? unsubscribe : subscribe}
                disabled={loading}
                className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-[0.98] flex items-center justify-center gap-2
                    ${isSubscribed 
                        ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                        : 'bg-slate-900 text-white shadow-xl shadow-slate-200'}`}
            >
                {loading ? <Loader2 className="animate-spin" size={14} /> : isSubscribed ? 'Disable Alerts' : 'Enable Alerts'}
            </button>
        </div>
    );
}
