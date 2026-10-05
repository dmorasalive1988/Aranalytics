import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { AuthError } from '@pluma/adapters';
import { isDomainError } from '@pluma/domain';
import { MESSAGES } from '@pluma/i18n';

export interface ActionState {
  error?: string;
  ok?: string;
}

const es = MESSAGES.es.errors as Record<string, string>;
const extra: Record<string, string> = {
  PUBLISHER_CODE_REQUIRED: 'Escribe el código de obra asignado en el registro.',
  ISWC_INVALID: 'El ISWC no es válido (revisa el dígito verificador).',
  WORK_NOT_SENT: 'La obra todavía no se envió a registro.',
  DISPUTE_NOT_OPEN: 'La disputa ya está resuelta.',
  RESOLUTION_REQUIRED: 'Describe la resolución (mínimo 5 caracteres).',
  NOTHING_TO_REINVITE: 'No hay firmas pendientes para reenviar.',
  COMMISSION_INVALID: 'La comisión debe estar entre 0 % y 50 %.',
  PRICE_INVALID: 'Revisa el precio.',
  USER_NOT_FOUND: 'No hay una cuenta con ese correo.',
  CANNOT_REVOKE_SELF: 'No puedes quitarte tu propio rol de super admin.',
};

export async function run(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? {};
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof AuthError) return { error: (MESSAGES.es.auth.errors as Record<string, string>)[e.code] };
    if (isDomainError(e)) return { error: extra[e.code] ?? es[e.code] ?? e.code };
    console.error(e);
    return { error: es.generic };
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
