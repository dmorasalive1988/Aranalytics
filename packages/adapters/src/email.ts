import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Categoría para métricas del proveedor ("split_invitation", "statement_published"…). */
  tag: string;
  /** Clave de idempotencia de la notificación. */
  idempotencyKey: string;
}

export interface EmailSender {
  send(msg: EmailMessage): Promise<{ providerMessageId: string }>;
}

/** Postmark: correo transaccional con webhooks de entrega, rebote y apertura. */
export class PostmarkEmail implements EmailSender {
  constructor(
    private readonly token: string,
    private readonly from: string,
    private readonly stream = 'outbound',
  ) {}

  async send(msg: EmailMessage) {
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Postmark-Server-Token': this.token },
      body: JSON.stringify({
        From: this.from,
        To: msg.to,
        Subject: msg.subject,
        HtmlBody: msg.html,
        TextBody: msg.text,
        Tag: msg.tag,
        MessageStream: this.stream,
        TrackOpens: true,
        Metadata: { idempotency_key: msg.idempotencyKey },
      }),
    });
    const body = (await res.json()) as { MessageID?: string; ErrorCode?: number; Message?: string };
    if (!res.ok || body.ErrorCode) throw new Error(`Postmark ${body.ErrorCode}: ${body.Message}`);
    return { providerMessageId: body.MessageID ?? '' };
  }
}

/** Desarrollo y pruebas: guarda cada correo como .json y .html en una carpeta. */
export class DevMailbox implements EmailSender {
  constructor(private readonly dir: string) {}

  async send(msg: EmailMessage) {
    await mkdir(this.dir, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeFile(join(this.dir, `${id}.json`), JSON.stringify({ id, at: new Date().toISOString(), ...msg }, null, 2));
    await writeFile(join(this.dir, `${id}.html`), msg.html);
    if (process.env.NODE_ENV !== 'test') console.log(`[correo] ${msg.to} · ${msg.subject}`);
    return { providerMessageId: `dev-${id}` };
  }
}
