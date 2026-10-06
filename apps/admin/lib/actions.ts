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
  WORK_CODE_TAKEN: 'Ese código de obra o ISWC ya está asignado a otra obra.',
  WORK_NOT_SENT: 'La obra todavía no se envió a registro.',
  DISPUTE_NOT_OPEN: 'La disputa ya está resuelta.',
  RESOLUTION_REQUIRED: 'Describe la resolución (mínimo 5 caracteres).',
  NOTHING_TO_REINVITE: 'No hay firmas pendientes para reenviar.',
  COMMISSION_INVALID: 'La comisión debe estar entre 0 % y 50 %.',
  PRICE_INVALID: 'Revisa el precio.',
  USER_NOT_FOUND: 'No hay una cuenta con ese correo.',
  PERIOD_CODE_INVALID: 'Usa el formato 2026-Q2, 2026-H1 o 2026-M07.',
  PAY_DATE_INVALID: 'Revisa la fecha de pago.',
  PERIOD_EXISTS: 'Ese período ya existe.',
  PERIOD_NOT_FOUND: 'No encontramos el período.',
  STATEMENT_FORMAT_UNKNOWN: 'No reconocemos el formato del archivo (revisa las columnas).',
  STATEMENT_EMPTY: 'El archivo no tiene líneas válidas.',
  FILE_ALREADY_UPLOADED: 'Ese mismo archivo ya se cargó en este período.',
  PERIOD_ALREADY_PUBLISHED: 'El período ya está publicado: las correcciones llegan como ajustes en un período posterior.',
  RECEIVED_AMOUNT_INVALID: 'Escribe el monto recibido en el banco (USD, hasta 2 decimales).',
  FX_RATE_MISSING: 'Falta la tasa de cambio de una moneda del archivo para la fecha de pago.',
  FX_RATE_INVALID: 'Revisa la tasa.',
  FX_SOURCE_REQUIRED: 'Indica la fuente de la tasa.',
  NO_FILES: 'Carga al menos un archivo antes de calcular.',
  RUN_NOT_FOUND: 'No encontramos la corrida.',
  RUN_UNBALANCED: 'La conciliación no cuadra: no se puede aprobar ni publicar.',
  RUN_NOT_RECONCILED: 'La corrida no está conciliada.',
  RUN_NOT_APPROVED: 'Falta la aprobación de una persona distinta a quien calculó.',
  APPROVER_MUST_DIFFER: 'Debe aprobar una persona distinta a quien calculó o preparó.',
  RUN_STALE_PLAN_CHANGED: 'Un autor cambió de plan después del cálculo. Recalcula: la comisión es la vigente al publicar.',
  LINE_NOT_FOUND: 'No encontramos la línea.',
  NOTHING_SELECTED: 'Selecciona al menos un retiro.',
  PROVIDER_REF_REQUIRED: 'Escribe la referencia del proveedor de pagos.',
  PAYOUT_NOT_APPROVED: 'El retiro no está aprobado.',
  PAYOUT_NOT_OPEN: 'El retiro ya se cerró.',
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
