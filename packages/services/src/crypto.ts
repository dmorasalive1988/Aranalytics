import { createHash, createHmac, randomInt } from 'node:crypto';

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
