import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import webpush from 'web-push';
import { createClient } from '@/utils/supabase/server';

// ✅ Prevents this route from being statically generated at build time
export const dynamic = 'force-dynamic';

// ✅ Build the VAPID subject with 'mailto:' prefix
const email = process.env.VAPID_EMAIL || '';
const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';

const vapidSubject = email.startsWith('mailto:') ? email : `mailto:${email}`;

// ✅ Only set VAPID details if all environment variables exist
if (vapidSubject && publicKey && privateKey) {
  webpush.setVapidDetails(vapidSubject, publicKey, privateKey);
} else {
  console.warn('⚠️ VAPID environment variables missing — Web Push will not work');
}

export async function POST(request: NextRequest) {
  const { event, payload } = await request.json();
  const supabase = await createClient();

  let title = 'Dean\'s Cup Fantasy';
  let body = '';
  let url = '/';

  switch (event) {
    case 'goal':
      body = `${payload.player_name} scored for ${payload.dept}!`;
      url = '/leaderboard';
      break;
    case 'price_change':
      body = `${payload.player_name}'s price changed to £${payload.new_price}m`;
      url = '/team';
      break;
    case 'transfer_window_open':
      body = 'Transfer window is now open!';
      url = '/team';
      break;
    default:
      body = 'New update available';
  }

  const { data: subs } = await supabase.from('push_subscriptions').select('subscription');

  if (!subs) return NextResponse.json({ success: false, message: 'No subscribers' });

  const results = await Promise.allSettled(
    subs.map(({ subscription }) =>
      webpush.sendNotification(subscription, JSON.stringify({ title, body, url }))
    )
  );

  return NextResponse.json({ success: true, sent: results.length });
}