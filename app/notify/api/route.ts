import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import webpush from 'web-push';
import { createClient } from '@/utils/supabase/server';

// ✅ Prevents this route from being statically generated at build time
export const dynamic = 'force-dynamic';

// ✅ Only set VAPID details if environment variables exist (prevents build crash)
if (
  process.env.VAPID_EMAIL &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY
) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
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