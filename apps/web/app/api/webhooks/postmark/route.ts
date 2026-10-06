import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { parsePostmarkWebhook } from '@pluma/adapters';
import { notifications } from '@pluma/services';
import { deps } from '@/lib/server';

/** Postmark firma con usuario y contraseña en la URL del webhook (https://pluma:SECRETO@app…/api/webhooks/postmark). */
function authorized(req: NextRequest) {
  const secret = process.env.POSTMARK_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  const given = header.startsWith('Basic ') ? Buffer.from(header.slice(6), 'base64').toString().split(':').slice(1).join(':') : '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Entregas, aperturas, rebotes y quejas de spam: actualizan el seguimiento y la lista de supresión. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
  const ev = parsePostmarkWebhook(body);
  if (!ev) return NextResponse.json({ ignored: true });
  const r = await notifications.applyEmailEvent(deps(), ev);
  return NextResponse.json({ received: true, matched: r.matched });
}
