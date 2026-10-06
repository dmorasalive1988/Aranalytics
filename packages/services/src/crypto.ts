import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt } from 'node:crypto';

export const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');

/** Código de 6 dígitos para firmar. */
export const sixDigitCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Enlace de firma de un coautor invitado: derivado con HMAC del id de la participación y la hora
 * de invitación. No se guarda el token, solo su hash: los recordatorios reconstruyen el mismo enlace
 * y una reinvitación (nueva hora) invalida el anterior.
 */
export function guestSignToken(secret: string, shareId: string, invitedAtIso: string) {
  return createHmac('sha256', secret).update(`${shareId}:${invitedAtIso}`).digest('base64url');
}

/** Cifrado de columna (AES-256-GCM): iv(12) | tag(16) | datos. */
export function encryptJson(key: Buffer, value: unknown): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(JSON.stringify(value), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]);
}

export function decryptJson<T>(key: Buffer, blob: Buffer): T {
  const d = createDecipheriv('aes-256-gcm', key, blob.subarray(0, 12));
  d.setAuthTag(blob.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(blob.subarray(28)), d.final()]).toString('utf8')) as T;
}
