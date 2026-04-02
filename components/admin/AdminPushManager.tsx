// components/admin/AdminPushManager.tsx
'use client';
import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

// Helper to convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string) {
    if (!base64String) {
        console.error('VAPID Public Key is empty or undefined!');
        return new Uint8Array(0);
    }
    try {
        const trimmed = base64String.trim();
        const padding = '='.repeat((4 - trimmed.length % 4) % 4);
        const base64 = (trimmed + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    } catch (e) {
        console.error('Failed to decode VAPID public key:', e);
        return new Uint8Array(0);
    }
}

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
            
            if (!VAPID_PUBLIC_KEY) {
                throw new Error('VAPID Public Key is missing. Please check your .env.local and restart the server.');
            }

            // 1. Request Permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error('Permission not granted for notifications.');
            }

            // 2. Subscribe to Push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });

            // 3. Save to Supabase
            const { error: dbError } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: userId,
                    endpoint: subscription.endpoint,
                    subscription_json: subscription.toJSON()
                }, { onConflict: 'endpoint' }); // Endpoint is unique enough

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
                    .match({ 'subscription_json->endpoint': subscription.endpoint });

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

            <div className="flex flex-col gap-2">
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

                {isSubscribed && (
                    <button
                        onClick={async () => {
                            setLoading(true);
                            try {
                                const res = await fetch('/api/admin/test-push', { method: 'POST' });
                                if (!res.ok) throw new Error('Test failed');
                                alert('Test Notification Sent! Check your device.');
                            } catch (e) {
                                alert('Failed to send test push.');
                            } finally {
                                setLoading(false);
                            }
                        }}
                        disabled={loading}
                        className="w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] bg-emerald-50 text-emerald-600 border border-emerald-100 transition-all active:scale-[0.95] flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : 'Send Test Push'}
                    </button>
                )}
            </div>
        </div>
    );
}
