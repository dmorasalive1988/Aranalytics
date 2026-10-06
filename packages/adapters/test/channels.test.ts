import { describe, expect, it } from 'vitest';
import { generateVapidKeys, parsePostmarkWebhook } from '../src';

describe('webhooks de correo', () => {
  it('normaliza entrega, apertura, rebote y spam', () => {
    expect(parsePostmarkWebhook({ RecordType: 'Delivery', MessageID: 'm1', DeliveredAt: '2026-10-06T10:00:00Z' })).toMatchObject({ type: 'delivered', messageId: 'm1' });
    expect(parsePostmarkWebhook({ RecordType: 'Open', MessageID: 'm1', ReceivedAt: '2026-10-06T10:05:00Z' })).toMatchObject({ type: 'opened' });
    expect(parsePostmarkWebhook({ RecordType: 'Bounce', MessageID: 'm2', Type: 'HardBounce', Email: 'x@y.co', Description: 'no existe' })).toMatchObject({ type: 'bounced', permanent: true, email: 'x@y.co' });
    expect(parsePostmarkWebhook({ RecordType: 'Bounce', MessageID: 'm3', Type: 'SoftBounce', Email: 'x@y.co' })).toMatchObject({ permanent: false });
    expect(parsePostmarkWebhook({ RecordType: 'SpamComplaint', MessageID: 'm4', Email: 'x@y.co' })).toMatchObject({ type: 'spam_complaint' });
    expect(parsePostmarkWebhook({ RecordType: 'Click', MessageID: 'm5' })).toBeNull();
  });
  it('genera claves VAPID', () => {
    const k = generateVapidKeys();
    expect(k.publicKey.length).toBeGreaterThan(80);
  });
});
