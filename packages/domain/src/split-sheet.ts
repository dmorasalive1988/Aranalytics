import { BPS_TOTAL } from './bps';
import type { WriterRole } from './splits';

export interface SplitSheetParty {
  name: string;
  email: string;
  ipi: string | null;
  society: string | null;
  role: WriterRole;
  bps: number;
  administered: boolean;
}

export interface SplitSheetInput {
  workId: string;
  title: string;
  altTitles: string[];
  language: string;
  version: number;
  createdAt: string; // ISO, fijo para la versión
  parties: SplitSheetParty[];
}

/**
 * Documento canónico de la hoja de splits. Es el texto exacto cuyo SHA-256 firman todas las
 * partes: determinista (orden fijo, sin datos de quien lo mira) para que el hash sea reproducible.
 */
export function canonicalSplitSheet(input: SplitSheetInput): string {
  const parties = [...input.parties].sort((a, b) => b.bps - a.bps || a.email.localeCompare(b.email));
  const lines = [
    'PLUMA · SPLIT SHEET',
    `work_id: ${input.workId}`,
    `title: ${input.title}`,
    `alt_titles: ${input.altTitles.join(' | ')}`,
    `language: ${input.language}`,
    `version: ${input.version}`,
    `created_at: ${input.createdAt}`,
    `total_bps: ${BPS_TOTAL}`,
    ...parties.map(
      (p, i) =>
        `party_${i + 1}: ${p.name} <${p.email.toLowerCase()}> | role=${p.role} | bps=${p.bps} | ipi=${p.ipi ?? '-'} | society=${p.society ?? '-'} | administered=${p.administered}`,
    ),
  ];
  return lines.join('\n') + '\n';
}
