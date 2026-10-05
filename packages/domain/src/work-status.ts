import { DomainError } from './errors';

export type WorkStatus =
  | 'draft'
  | 'awaiting_signatures'
  | 'splits_signed'
  | 'sent_to_publisher'
  | 'registered'
  | 'disputed';

export const WORK_STATUSES: readonly WorkStatus[] = [
  'draft', 'awaiting_signatures', 'splits_signed', 'sent_to_publisher', 'registered', 'disputed',
];

/** Transiciones permitidas. "disputed" se resuelve volviendo al estado que corresponda a las firmas. */
const TRANSITIONS: Record<WorkStatus, readonly WorkStatus[]> = {
  draft: ['awaiting_signatures'],
  awaiting_signatures: ['splits_signed', 'disputed', 'draft'],
  splits_signed: ['sent_to_publisher', 'disputed'],
  sent_to_publisher: ['registered', 'disputed', 'splits_signed'],
  registered: ['disputed'],
  disputed: ['draft', 'awaiting_signatures', 'splits_signed', 'sent_to_publisher', 'registered'],
};

export const canTransition = (from: WorkStatus, to: WorkStatus) => TRANSITIONS[from].includes(to);

export function assertTransition(from: WorkStatus, to: WorkStatus): void {
  if (!canTransition(from, to)) throw new DomainError('WORK_INVALID_TRANSITION', { from, to });
}

/** Tono de la píldora de estado según el sistema de diseño. */
export type PillTone = 'outline' | 'coral' | 'ambar' | 'niebla' | 'verde';
export const WORK_STATUS_TONE: Record<WorkStatus, PillTone> = {
  draft: 'outline',
  awaiting_signatures: 'coral',
  splits_signed: 'ambar',
  sent_to_publisher: 'niebla',
  registered: 'verde',
  disputed: 'coral',
};

/** ¿Puede el creador editar los metadatos de la obra? Solo antes de enviarla a firma. */
export const isWorkEditable = (s: WorkStatus) => s === 'draft';

/** ¿Las regalías de la obra se retienen? */
export const isWorkOnHold = (s: WorkStatus) => s === 'disputed';
