import type { EmailSender, ObjectStorage, PaymentProvider, PushSender, TimestampAuthority, WhatsAppSender } from '@pluma/adapters';
import type { Db } from '@pluma/db';

export interface Deps {
  db: Db;
  mail: EmailSender;
  push: PushSender;
  /** null = WhatsApp apagado (por defecto). */
  whatsapp: WhatsAppSender | null;
  payments: PaymentProvider;
  storage: ObjectStorage;
  tsa: TimestampAuthority;
  /** URL pública de la app del autor (https://app.pluma.mu). */
  appUrl: string;
  /** URL pública de la firma de coautores (https://firma.pluma.mu). */
  signUrl: string;
  /** Secreto para derivar enlaces de firma (HMAC). */
  signingSecret: string;
  /** Clave AES-256 (32 bytes) para datos sensibles: ID fiscal y datos bancarios. */
  dataKey: Buffer;
  now: () => Date;
}

/** Datos de la petición que quedan como evidencia (firma) y en la auditoría. */
export interface RequestCtx {
  ip: string | null;
  userAgent: string | null;
}

export const NO_REQUEST: RequestCtx = { ip: null, userAgent: null };
