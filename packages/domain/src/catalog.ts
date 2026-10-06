import { DomainError } from './errors';

/* ------------------------------- Vocabulario ------------------------------- */

export const MOODS = ['happy', 'sad', 'romantic', 'energetic', 'chill', 'dark', 'epic', 'nostalgic', 'sensual', 'uplifting', 'party', 'dramatic'] as const;
export type Mood = (typeof MOODS)[number];
export const VOCALS = ['female', 'male', 'duet', 'choir', 'none'] as const;
export type Vocals = (typeof VOCALS)[number];
export const LICENSE_USAGES = ['social_media', 'digital_ads', 'tv_film', 'videogame', 'other'] as const;
export type LicenseUsage = (typeof LICENSE_USAGES)[number];
export const TERRITORIES = ['LATAM', 'US', 'WORLD'] as const;
export type Territory = (typeof TERRITORIES)[number];
export const TERMS = [3, 6, 12, 24, 36] as const;
export const HOLD_DAYS = [30, 60, 90] as const;

/* -------------------------------- Cotizador -------------------------------- */

/** Plazo relativo a la tarifa base de 12 meses. */
export const TERM_FACTOR: Record<number, number> = { 3: 0.5, 6: 0.7, 12: 1, 24: 1.6, 36: 2 };
/** One-stop: la misma licencia cubre la obra y el máster. */
export const ONE_STOP_FACTOR = 1.8;

/** Rango de tarifa en centavos, redondeado a USD 50. Las tarifas base son referenciales hasta tener la tabla real. */
export function quote(base: { minCents: number; maxCents: number }, termMonths: number, oneStop: boolean) {
  const f = TERM_FACTOR[termMonths];
  if (!f) throw new DomainError('TERM_INVALID');
  const k = f * (oneStop ? ONE_STOP_FACTOR : 1);
  const round = (c: number) => Math.round((c * k) / 5000) * 5000;
  return { minCents: round(base.minCents), maxCents: round(base.maxCents) };
}

/* ------------------------- Consulta en lenguaje natural ------------------------- */

export interface SyncFilters {
  text: string;
  moods: Mood[];
  genres: string[];
  languages: string[];
  vocals: Vocals | null;
  instrumental: boolean | null;
  oneStop: boolean | null;
  bpmMin: number | null;
  bpmMax: number | null;
}

export const emptyFilters = (text = ''): SyncFilters => ({ text, moods: [], genres: [], languages: [], vocals: null, instrumental: null, oneStop: null, bpmMin: null, bpmMax: null });

const MOOD_WORDS: Record<Mood, string[]> = {
  happy: ['alegre', 'feliz', 'happy', 'joyful', 'alegria', 'alegría', 'feliz'],
  sad: ['triste', 'sad', 'melancolica', 'melancólica', 'melancholic', 'tristeza'],
  romantic: ['romantica', 'romántica', 'romantico', 'romántico', 'romantic', 'amor', 'love', 'romântica', 'romântico'],
  energetic: ['energica', 'enérgica', 'energetico', 'enérgico', 'energetic', 'energia', 'energía', 'energy', 'enérgico', 'energética'],
  chill: ['chill', 'relajada', 'relajado', 'tranquila', 'calm', 'relaxed', 'relaxante', 'calma'],
  dark: ['oscura', 'oscuro', 'dark', 'sombria', 'sombría', 'sombrio', 'sombrio'],
  epic: ['epica', 'épica', 'epic', 'épico', 'epico'],
  nostalgic: ['nostalgica', 'nostálgica', 'nostalgic', 'nostalgia', 'nostálgico'],
  sensual: ['sensual', 'sexy'],
  uplifting: ['inspiradora', 'inspirador', 'uplifting', 'inspiring', 'motivacional', 'esperanza', 'hopeful'],
  party: ['fiesta', 'party', 'bailable', 'danceable', 'festa', 'perreo'],
  dramatic: ['dramatica', 'dramática', 'dramatic', 'dramático', 'intensa', 'intense'],
};
const GENRES = ['reggaetón', 'reggaeton', 'cumbia', 'salsa', 'bachata', 'merengue', 'vallenato', 'dembow', 'corrido', 'regional mexicano', 'banda', 'trap', 'pop', 'latin pop', 'r&b', 'rock', 'balada', 'bolero', 'tango', 'forró', 'forro', 'samba', 'bossa nova', 'mpb', 'funk', 'piseiro', 'sertanejo', 'afrobeat', 'electrónica', 'electronica', 'house', 'hip hop', 'rap', 'jazz', 'folk', 'champeta'];
const LANGS: Record<string, string[]> = { es: ['español', 'espanol', 'spanish', 'espanhol', 'castellano'], en: ['inglés', 'ingles', 'english', 'inglês'], pt: ['portugués', 'portugues', 'portuguese', 'português'] };

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Traduce una búsqueda como "reggaetón alegre instrumental 90-100 bpm en español, one-stop" a filtros duros
 * y deja el resto como texto libre. Es el respaldo sin API: con ANTHROPIC_API_KEY, un modelo hace esta traducción.
 */
export function parseSyncQuery(q: string): SyncFilters {
  const f = emptyFilters();
  let rest = ` ${norm(q)} `;
  const take = (re: RegExp) => {
    const m = rest.match(re);
    if (m) rest = rest.replace(m[0], ' ');
    return m;
  };
  const range = take(/(\d{2,3})\s*(?:-|–|a|to|ate|até)\s*(\d{2,3})\s*bpm/);
  if (range) {
    f.bpmMin = Math.min(+range[1]!, +range[2]!);
    f.bpmMax = Math.max(+range[1]!, +range[2]!);
  } else {
    const one = take(/(\d{2,3})\s*bpm/);
    if (one) {
      f.bpmMin = +one[1]! - 5;
      f.bpmMax = +one[1]! + 5;
    }
  }
  if (take(/\bone[\s-]?stop\b/)) f.oneStop = true;
  if (take(/\b(instrumental|sin voz|sin letra|no vocals|without vocals|sem voz)\b/)) {
    f.instrumental = true;
    f.vocals = 'none';
  }
  if (take(/\b(voz femenina|cantante femenina|female vocals?|female singer|voz feminina)\b/)) f.vocals = 'female';
  else if (take(/\b(voz masculina|cantante masculino|male vocals?|male singer)\b/)) f.vocals = 'male';
  else if (take(/\b(dueto|duet|dupla)\b/)) f.vocals = 'duet';
  else if (take(/\b(coro|choir|coral)\b/)) f.vocals = 'choir';
  for (const [code, words] of Object.entries(LANGS)) {
    for (const w of words) if (take(new RegExp(`\\b(?:en |in |em )?${norm(w)}\\b`))) f.languages.includes(code) || f.languages.push(code);
  }
  for (const g of [...GENRES].sort((a, b) => b.length - a.length)) {
    const n = norm(g);
    if (take(new RegExp(`(^|\\s)${n.replace(/[&]/g, '\\&')}(?=\\s|,|$)`))) {
      const canonical = n === 'reggaeton' ? 'reggaeton' : n === 'forro' ? 'forro' : n;
      if (!f.genres.includes(canonical)) f.genres.push(canonical);
    }
  }
  for (const m of MOODS) {
    for (const w of MOOD_WORDS[m]) if (take(new RegExp(`\\b${norm(w)}\\b`))) f.moods.includes(m) || f.moods.push(m);
  }
  const STOP = /\b(una|un|uma|a|an|the|la|el|los|las|lo|o|os|as|um|of|on|at|to|de|del|da|do|para|for|con|com|with|cancion|cancao|song|track|tema|musica|music|busco|quiero|need|looking|que|sea|y|and|e|en|in|em|algo|something|bpm|voz|vocals?)\b/g;
  f.text = rest.replace(/[,.;:!?]/g, ' ').replace(STOP, ' ').replace(/\s+/g, ' ').trim();
  return f;
}
