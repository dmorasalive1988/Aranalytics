import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { MOODS, VOCALS, parseSyncQuery, type SyncFilters } from '@pluma/domain';

/** Traduce una búsqueda en lenguaje natural de Pluma Sync a filtros duros + texto libre. */
export interface QueryParser {
  readonly kind: 'rules' | 'claude';
  parse(query: string): Promise<SyncFilters>;
}

/** Sin API: reglas en español, inglés y portugués (ver @pluma/domain). */
export class RuleQueryParser implements QueryParser {
  readonly kind = 'rules' as const;
  async parse(query: string) {
    return parseSyncQuery(query);
  }
}

const FiltersSchema = z.object({
  text: z.string(),
  moods: z.array(z.enum(MOODS)),
  genres: z.array(z.string()),
  languages: z.array(z.string()),
  vocals: z.enum(VOCALS).nullable(),
  instrumental: z.boolean().nullable(),
  oneStop: z.boolean().nullable(),
  bpmMin: z.number().int().nullable(),
  bpmMax: z.number().int().nullable(),
});

const SYSTEM = `You turn a music supervisor's search for a song into catalog filters for Pluma Sync, a Latin music catalog.
The query can be in Spanish, English or Portuguese. Put a constraint in a filter only when the query states it; leave the rest null or empty.
- moods: only from the allowed list; map synonyms (e.g. "alegre" -> happy, "perreo" -> party).
- genres: lowercase, without accents (e.g. "reggaeton", "cumbia", "latin pop", "forro").
- languages: ISO 639-1 codes of the lyrics (es, en, pt).
- vocals: none when the query asks for an instrumental.
- bpmMin/bpmMax: a range; for a single tempo use ±5.
- text: the remaining descriptive words useful for full-text search (scene, theme), lowercase, without filler words.`;

/** Con ANTHROPIC_API_KEY: un modelo traduce la consulta; si falla o se niega, se usan las reglas. */
export class ClaudeQueryParser implements QueryParser {
  readonly kind = 'claude' as const;
  private readonly client: Anthropic;
  private readonly fallback = new RuleQueryParser();
  constructor(apiKey?: string) {
    this.client = new Anthropic(apiKey ? { apiKey } : {});
  }
  async parse(query: string): Promise<SyncFilters> {
    try {
      const r = await this.client.messages.parse({
        model: 'claude-opus-5-5',
        max_tokens: 4000,
        system: SYSTEM,
        output_config: { effort: 'low', format: zodOutputFormat(FiltersSchema) },
        messages: [{ role: 'user', content: query.slice(0, 500) }],
      });
      if (r.stop_reason === 'refusal' || !r.parsed_output) return this.fallback.parse(query);
      return r.parsed_output;
    } catch (e) {
      console.error('[búsqueda] el modelo no respondió; uso las reglas', e instanceof Anthropic.APIError ? e.status : (e as Error).message);
      return this.fallback.parse(query);
    }
  }
}
