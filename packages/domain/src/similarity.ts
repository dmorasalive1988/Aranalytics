/** Título normalizado para comparar: sin tildes, sin "feat.", sin puntuación, en minúsculas. */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[([](?:feat|ft|featuring|con|with|remix|version|versión|live|en vivo)[^)\]]*[)\]]/g, ' ')
    .replace(/\b(feat|ft|featuring)\.?\s.*$/, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Trigramas al estilo de pg_trgm, para que la app y la base coincidan. */
function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const word of s.split(' ').filter(Boolean)) {
    const w = `  ${word} `;
    for (let i = 0; i < w.length - 2; i++) out.add(w.slice(i, i + 3));
  }
  return out;
}

export function titleSimilarity(a: string, b: string): number {
  const A = trigrams(normalizeTitle(a));
  const B = trigrams(normalizeTitle(b));
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

export interface ConflictCandidate {
  workId: string;
  ownerId: string;
  title: string;
  isrcs: string[];
  iswc: string | null;
  audioSha256: string | null;
}

export interface ConflictInput {
  ownerId: string;
  title: string;
  isrcs: string[];
  iswc: string | null;
  audioSha256: string | null;
}

export type ConflictReason = 'audio_hash' | 'iswc' | 'title_isrc' | 'title';

export interface Conflict {
  workId: string;
  reason: ConflictReason;
  score: number;
}

export const TITLE_ALERT_THRESHOLD = 0.85;
export const TITLE_WITH_ISRC_THRESHOLD = 0.5;

/**
 * Detección de conflictos contra obras de OTROS usuarios. La alerta no bloquea por sí sola:
 * crea un caso para el operador y avisa al autor.
 */
export function detectConflicts(input: ConflictInput, candidates: ConflictCandidate[]): Conflict[] {
  const myIsrcs = new Set(input.isrcs);
  const out: Conflict[] = [];
  for (const c of candidates) {
    if (c.ownerId === input.ownerId) continue;
    const sim = titleSimilarity(input.title, c.title);
    const sharedIsrc = c.isrcs.some((i) => myIsrcs.has(i));
    if (input.audioSha256 && input.audioSha256 === c.audioSha256) out.push({ workId: c.workId, reason: 'audio_hash', score: 1 });
    else if (input.iswc && input.iswc === c.iswc) out.push({ workId: c.workId, reason: 'iswc', score: 1 });
    else if (sharedIsrc && sim >= TITLE_WITH_ISRC_THRESHOLD) out.push({ workId: c.workId, reason: 'title_isrc', score: Math.max(sim, 0.9) });
    else if (sim >= TITLE_ALERT_THRESHOLD) out.push({ workId: c.workId, reason: 'title', score: sim });
  }
  return out.sort((a, b) => b.score - a.score);
}
