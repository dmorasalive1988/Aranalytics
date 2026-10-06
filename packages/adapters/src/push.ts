import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import webpush from 'web-push';

export interface PushSubscriptionData {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** gone = la suscripción ya no existe (404/410): hay que borrarla. */
export type PushResult = { ok: true } | { ok: false; gone: boolean; error: string };

export interface PushSender {
  readonly publicKey: string | null;
  send(sub: PushSubscriptionData, msg: PushMessage): Promise<PushResult>;
}

/** Web Push estándar con VAPID (funciona con la PWA en Chrome, Edge, Firefox y Safari 16.4+). */
export class WebPushSender implements PushSender {
  constructor(
    readonly publicKey: string,
    private readonly privateKey: string,
    private readonly subject: string,
  ) {}
  async send(sub: PushSubscriptionData, msg: PushMessage): Promise<PushResult> {
    try {
      await webpush.sendNotification(sub, JSON.stringify(msg), { vapidDetails: { subject: this.subject, publicKey: this.publicKey, privateKey: this.privateKey }, TTL: 60 * 60 * 24, topic: msg.tag.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, '') });
      return { ok: true };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      return { ok: false, gone: status === 404 || status === 410, error: String((e as Error).message).slice(0, 300) };
    }
  }
}

/** Desarrollo: guarda cada push como JSON en una carpeta. */
export class DevPush implements PushSender {
  readonly publicKey: string | null;
  constructor(private readonly dir: string, publicKey: string | null = null) {
    this.publicKey = publicKey;
  }
  async send(sub: PushSubscriptionData, msg: PushMessage): Promise<PushResult> {
    await mkdir(this.dir, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeFile(join(this.dir, `.${id}.tmp`), JSON.stringify({ id, endpoint: sub.endpoint, ...msg }, null, 2));
    await rename(join(this.dir, `.${id}.tmp`), join(this.dir, `${id}.json`));
    if (sub.endpoint.includes('gone')) return { ok: false, gone: true, error: '410' };
    return { ok: true };
  }
}

export const generateVapidKeys = () => webpush.generateVAPIDKeys();
