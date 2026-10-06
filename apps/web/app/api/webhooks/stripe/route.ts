import { NextResponse, type NextRequest } from 'next/server';
import { applyPaymentEvent } from '@pluma/services';
import { deps, kickDispatch } from '@/lib/server';

/** Webhook de Stripe: verifica la firma y aplica el evento normalizado (idempotente). */
export async function POST(req: NextRequest) {
  const d = deps();
  const raw = await req.text();
  try {
    const ev = await d.payments.parseWebhook(raw, req.headers.get('stripe-signature'));
    if (ev) {
      await applyPaymentEvent(d, ev);
      await kickDispatch();
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('[stripe]', (e as Error).message);
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  }
}
