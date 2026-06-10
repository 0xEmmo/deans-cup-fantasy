// hooks/usePushNotifications.ts
'use client';
import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';

export function usePushNotifications() {
  useEffect(() => {
    const supabase = createClient();
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (!publicKey) return;

    async function subscribe() {
      // Check if already subscribed
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .single();

      if (existing) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        subscription: subscription.toJSON(),
      });
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then(subscribe);
    }
  }, []);
}