import { BPS_TOTAL } from './bps';
import { DomainError } from './errors';
import type { WriterRole } from './splits';

export type RequestType = 'beat_seeks_topliner' | 'seeks_producer' | 'seeks_verse_or_hook' | 'session_or_camp';
export const REQUEST_TYPES: readonly RequestType[] = ['beat_seeks_topliner', 'seeks_producer', 'seeks_verse_or_hook', 'session_or_camp'];
export type Modality = 'remote' | 'in_person' | 'hybrid';
export const MODALITIES: readonly Modality[] = ['remote', 'in_person', 'hybrid'];

const DAY = 86_400_000;
/** Vigencia de una solicitud (renovable). */
export const REQUEST_TTL_DAYS = 30;
/** Una postulación vence a los 7 días; a las 72 h sin respuesta se recuerda a quien publicó. */
export const APPLICATION_TTL_DAYS = 7;
export const APPLICATION_REMINDER_HOURS = 72;
/** Ventana del cupo de postulaciones ("del día"): 24 horas corridas. */
export const QUOTA_WINDOW_MS = DAY;

export const requestExpiry = (from: Date) => new Date(from.getTime() + REQUEST_TTL_DAYS * DAY);
export const applicationExpiry = (from: Date) => new Date(from.getTime() + APPLICATION_TTL_DAYS * DAY);

/** Roles del split pre-acordado según el tipo de solicitud: quien publica y quien se postula. */
export function rolesFor(type: RequestType): { owner: WriterRole; applicant: WriterRole } {
  switch (type) {
    case 'beat_seeks_topliner':
      return { owner: 'composer', applicant: 'composer_lyricist' };
    case 'seeks_producer':
      return { owner: 'composer_lyricist', applicant: 'composer' };
    case 'seeks_verse_or_hook':
    case 'session_or_camp':
      return { owner: 'composer_lyricist', applicant: 'composer_lyricist' };
  }
}

/** Split pre-acordado: quien se postula recibe lo ofrecido y quien publica el resto (suma 100 %). */
export function preAgreedShares(type: RequestType, ownerId: string, applicantId: string, offeredBps: number) {
  if (!Number.isInteger(offeredBps) || offeredBps < 1 || offeredBps >= BPS_TOTAL) throw new DomainError('SHARE_INVALID');
  const roles = rolesFor(type);
  return [
    { userId: ownerId, role: roles.owner, bps: BPS_TOTAL - offeredBps },
    { userId: applicantId, role: roles.applicant, bps: offeredBps },
  ];
}

/** Cupo restante: límite del plan menos las postulaciones de las últimas 24 h. */
export function remainingQuota(limit: number, recent: Date[], now: Date) {
  const used = recent.filter((d) => now.getTime() - d.getTime() < QUOTA_WINDOW_MS).length;
  const remaining = Math.max(limit - used, 0);
  // Se libera un cupo cuando la postulación más antigua de la ventana cumple 24 h.
  const oldest = recent.filter((d) => now.getTime() - d.getTime() < QUOTA_WINDOW_MS).sort((a, b) => a.getTime() - b.getTime())[0];
  return { limit, used, remaining, nextSlotAt: remaining === 0 && oldest ? new Date(oldest.getTime() + QUOTA_WINDOW_MS) : null };
}

/** Postulaciones pendientes: ¿toca recordar o vencer? */
export function applicationTimer(createdAt: Date, reminderSentAt: Date | null, expiresAt: Date, now: Date): 'expire' | 'remind' | 'wait' {
  if (now >= expiresAt) return 'expire';
  if (!reminderSentAt && now.getTime() - createdAt.getTime() >= APPLICATION_REMINDER_HOURS * 3_600_000) return 'remind';
  return 'wait';
}

export interface RequestInput {
  type: string;
  title: string;
  description: string;
  genre: string;
  languages: string[];
  bpm: number | null;
  city: string | null;
  modality: string;
  offeredShareBps: number;
}

export function validateRequest(i: RequestInput): asserts i is RequestInput & { type: RequestType; modality: Modality } {
  if (!REQUEST_TYPES.includes(i.type as RequestType)) throw new DomainError('REQUEST_TYPE_INVALID');
  if (i.title.trim().length < 3 || i.title.trim().length > 120) throw new DomainError('TITLE_REQUIRED');
  if (i.description.trim().length < 10 || i.description.trim().length > 2000) throw new DomainError('DESCRIPTION_REQUIRED');
  if (!i.genre.trim()) throw new DomainError('GENRE_REQUIRED');
  if (!i.languages.length) throw new DomainError('LANGUAGE_REQUIRED');
  if (i.bpm !== null && (!Number.isInteger(i.bpm) || i.bpm < 40 || i.bpm > 240)) throw new DomainError('BPM_INVALID');
  if (!MODALITIES.includes(i.modality as Modality)) throw new DomainError('MODALITY_INVALID');
  if ((i.modality === 'in_person' || i.modality === 'hybrid') && !i.city?.trim()) throw new DomainError('CITY_REQUIRED');
  if (!Number.isInteger(i.offeredShareBps) || i.offeredShareBps < 100 || i.offeredShareBps > 9000) throw new DomainError('OFFERED_SHARE_INVALID');
}
