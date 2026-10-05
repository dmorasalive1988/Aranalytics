import { BPS_TOTAL } from './bps';

export type WriterRole = 'composer' | 'lyricist' | 'composer_lyricist' | 'arranger' | 'translator';
export const WRITER_ROLES: readonly WriterRole[] = ['composer_lyricist', 'composer', 'lyricist', 'arranger', 'translator'];

export type SplitParty =
  | { kind: 'member'; userId: string }
  | { kind: 'external'; name: string; email: string };

export interface DraftShare {
  party: SplitParty;
  role: WriterRole;
  bps: number;
}

export type SplitIssueCode =
  | 'EMPTY'
  | 'SHARE_NOT_POSITIVE'
  | 'SHARE_NOT_INTEGER_BPS'
  | 'DUPLICATE_PARTY'
  | 'EXTERNAL_NAME_REQUIRED'
  | 'EXTERNAL_EMAIL_INVALID'
  | 'CREATOR_MISSING'
  | 'TOTAL_NOT_100';

export interface SplitIssue {
  code: SplitIssueCode;
  index?: number;
}

export interface SplitValidation {
  ok: boolean;
  totalBps: number;
  /** Lo que falta para 100 % (negativo si se pasa). */
  remainingBps: number;
  issues: SplitIssue[];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isValidEmail = (email: string) => EMAIL_RE.test(email.trim());

const partyKey = (p: SplitParty) =>
  p.kind === 'member' ? `m:${p.userId}` : `e:${p.email.trim().toLowerCase()}`;

/**
 * Valida un reparto antes de enviarlo a firma. Regla central del criterio 2:
 * solo se puede enviar si suma exactamente 100,00 %.
 */
export function validateSplit(shares: DraftShare[], creatorUserId?: string): SplitValidation {
  const issues: SplitIssue[] = [];
  if (shares.length === 0) issues.push({ code: 'EMPTY' });

  const seen = new Set<string>();
  let total = 0;
  shares.forEach((s, index) => {
    if (!Number.isInteger(s.bps)) issues.push({ code: 'SHARE_NOT_INTEGER_BPS', index });
    else if (s.bps <= 0) issues.push({ code: 'SHARE_NOT_POSITIVE', index });
    total += Number.isFinite(s.bps) ? s.bps : 0;

    if (s.party.kind === 'external') {
      if (!s.party.name.trim()) issues.push({ code: 'EXTERNAL_NAME_REQUIRED', index });
      if (!isValidEmail(s.party.email)) issues.push({ code: 'EXTERNAL_EMAIL_INVALID', index });
    }
    const key = partyKey(s.party);
    if (seen.has(key)) issues.push({ code: 'DUPLICATE_PARTY', index });
    seen.add(key);
  });

  if (creatorUserId && !shares.some((s) => s.party.kind === 'member' && s.party.userId === creatorUserId)) {
    issues.push({ code: 'CREATOR_MISSING' });
  }
  if (total !== BPS_TOTAL) issues.push({ code: 'TOTAL_NOT_100' });

  return { ok: issues.length === 0, totalBps: total, remainingBps: BPS_TOTAL - total, issues };
}

export type ShareStatus = 'pending' | 'signed' | 'rejected';
export type SplitVersionStatus = 'draft' | 'pending_signatures' | 'signed' | 'rejected' | 'superseded';

/** Estado de la versión a partir de las firmas: cualquier rechazo la rechaza; todas firmadas la cierran. */
export function versionStatusFromShares(statuses: ShareStatus[]): Extract<SplitVersionStatus, 'pending_signatures' | 'signed' | 'rejected'> {
  if (statuses.some((s) => s === 'rejected')) return 'rejected';
  if (statuses.length > 0 && statuses.every((s) => s === 'signed')) return 'signed';
  return 'pending_signatures';
}

/** Comparación de dos repartos: ¿cambió algo que exija volver a firmar? */
export function splitsDiffer(a: DraftShare[], b: DraftShare[]): boolean {
  const norm = (xs: DraftShare[]) =>
    xs.map((s) => `${partyKey(s.party)}|${s.role}|${s.bps}`).sort().join(';');
  return norm(a) !== norm(b);
}
