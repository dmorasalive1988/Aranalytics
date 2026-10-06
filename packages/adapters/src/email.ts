import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sql, type Db } from '@pluma/db';

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
    // Escritura atómica: quien lea la carpeta nunca ve un archivo a medio escribir.
    for (const [ext, body] of [['html', msg.html], ['json', JSON.stringify({ id, at: new Date().toISOString(), ...msg }, null, 2)]] as const) {
      await writeFile(join(this.dir, `.${id}.${ext}.tmp`), body);
      await rename(join(this.dir, `.${id}.${ext}.tmp`), join(this.dir, `${id}.${ext}`));
    }
    if (process.env.NODE_ENV !== 'test') console.log(`[correo] ${msg.to} · ${msg.subject}`);
    return { providerMessageId: `dev-${id}` };
  }
}

/**
 * Demo: guarda los correos en la base (pluma_demo.mail) para mostrarlos dentro de la app,
 * con sus códigos y enlaces. No sale ningún correo real.
 */
export class DemoMailbox implements EmailSender {
  constructor(private readonly db: Db) {}
  async send(msg: EmailMessage) {
    const [r] = await this.db.execute<{ id: string }>(sql`
      insert into pluma_demo.mail (recipient, subject, html, body_text, tag) values (${msg.to.toLowerCase()}, ${msg.subject}, ${msg.html}, ${msg.text}, ${msg.tag}) returning id::text`);
    return { providerMessageId: `demo-${r!.id}` };
  }
}

export type DemoMail = {
  id: string;
  recipient: string;
  subject: string;
  html: string;
  body_text: string;
  tag: string;
  created_at: string;
};

export async function listDemoMail(db: Db, opts: { recipient?: string; tag?: string; limit?: number } = {}): Promise<DemoMail[]> {
  return db.execute<DemoMail>(sql`
    select id::text, recipient, subject, html, body_text, tag, created_at::text from pluma_demo.mail
    where true ${opts.recipient ? sql`and recipient = ${opts.recipient.toLowerCase()}` : sql``} ${opts.tag ? sql`and tag = ${opts.tag}` : sql``}
    order by created_at desc, id desc limit ${Math.min(opts.limit ?? 50, 200)}`);
}
