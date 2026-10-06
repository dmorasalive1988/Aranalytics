import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface WhatsAppMessage {
  to: string; // E.164
  template: string;
  language: string;
  params: string[];
}

export interface WhatsAppSender {
  send(msg: WhatsAppMessage): Promise<{ providerMessageId: string }>;
}

/** WhatsApp Cloud API de Meta, con plantillas aprobadas. */
export class MetaWhatsApp implements WhatsAppSender {
  constructor(
    private readonly phoneNumberId: string,
    private readonly token: string,
  ) {}
  async send(msg: WhatsAppMessage) {
    const res = await fetch(`https://graph.facebook.com/v21.0/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.to.replace(/^\+/, ''),
        type: 'template',
        template: { name: msg.template, language: { code: msg.language }, components: [{ type: 'body', parameters: msg.params.map((text) => ({ type: 'text', text })) }] },
      }),
    });
    const body = (await res.json()) as { messages?: { id: string }[]; error?: { message: string } };
    if (!res.ok || !body.messages?.[0]) throw new Error(`WhatsApp: ${body.error?.message ?? res.status}`);
    return { providerMessageId: body.messages[0].id };
  }
}

export class DevWhatsApp implements WhatsAppSender {
  constructor(private readonly dir: string) {}
  async send(msg: WhatsAppMessage) {
    await mkdir(this.dir, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeFile(join(this.dir, `.${id}.tmp`), JSON.stringify({ id, ...msg }, null, 2));
    await rename(join(this.dir, `.${id}.tmp`), join(this.dir, `${id}.json`));
    return { providerMessageId: `dev-wa-${id}` };
  }
}
