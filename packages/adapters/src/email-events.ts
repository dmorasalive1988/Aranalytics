/** Evento de entrega normalizado (webhooks del proveedor de correo). */
export type EmailEvent =
  | { type: 'delivered'; messageId: string; at: Date }
  | { type: 'opened'; messageId: string; at: Date }
  | { type: 'bounced'; messageId: string; at: Date; email: string; permanent: boolean; detail: string }
  | { type: 'spam_complaint'; messageId: string; at: Date; email: string };

/**
 * Webhooks de Postmark (Delivery, Open, Bounce, SpamComplaint). Postmark se autentica con usuario y
 * contraseña en la URL del webhook: la verificación de esas credenciales la hace la ruta.
 */
export function parsePostmarkWebhook(body: Record<string, unknown>): EmailEvent | null {
  const id = String(body.MessageID ?? '');
  if (!id) return null;
  const at = new Date(String(body.DeliveredAt ?? body.ReceivedAt ?? body.BouncedAt ?? new Date().toISOString()));
  switch (body.RecordType) {
    case 'Delivery':
      return { type: 'delivered', messageId: id, at };
    case 'Open':
      return { type: 'opened', messageId: id, at };
    case 'Bounce': {
      // Rebotes permanentes según Postmark: HardBounce, BadEmailAddress, ManuallyDeactivated, SpamNotification…
      const permanent = ['HardBounce', 'BadEmailAddress', 'ManuallyDeactivated', 'Blocked', 'SpamNotification'].includes(String(body.Type));
      return { type: 'bounced', messageId: id, at, email: String(body.Email ?? ''), permanent, detail: String(body.Description ?? body.Type ?? '').slice(0, 300) };
    }
    case 'SpamComplaint':
      return { type: 'spam_complaint', messageId: id, at, email: String(body.Email ?? '') };
    default:
      return null;
  }
}
