// components/PushNotificationProvider.tsx
'use client';

import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function PushNotificationProvider() {
  usePushNotifications();
  return null; // renders nothing
}