import { describe, expect, it } from 'vitest';
import { MESSAGES, negotiateLocale } from '../src';

const keys = (o: unknown, prefix = ''): string[] =>
  Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\s*[,}]/g)].map((m) => m[1]).sort();
const get = (o: unknown, path: string) => path.split('.').reduce((acc, k) => (acc as Record<string, unknown>)[k], o) as string;

describe('mensajes', () => {
  const es = keys(MESSAGES.es).sort();
  it.each(['en', 'pt-BR'] as const)('%s tiene exactamente las mismas claves que es', (l) => {
    expect(keys(MESSAGES[l]).sort()).toEqual(es);
  });
  it.each(['en', 'pt-BR'] as const)('%s usa los mismos parámetros en cada texto', (l) => {
    for (const k of es) expect(placeholders(get(MESSAGES[l], k)), k).toEqual(placeholders(get(MESSAGES.es, k)));
  });
  it('no hay textos vacíos ni copiados del español sin traducir en frases largas', () => {
    for (const l of ['en', 'pt-BR'] as const) {
      for (const k of es) {
        const v = get(MESSAGES[l], k);
        expect(v.trim(), `${l}:${k}`).not.toBe('');
        if (get(MESSAGES.es, k).length > 40 && !k.startsWith('common.languages') && !get(MESSAGES.es, k).includes('plural')) expect(v, `${l}:${k}`).not.toBe(get(MESSAGES.es, k));
      }
    }
  });
  it('negocia el idioma del navegador', () => {
    expect(negotiateLocale('pt-PT,pt;q=0.9')).toBe('pt-BR');
    expect(negotiateLocale('en-US,en;q=0.9,es;q=0.8')).toBe('en');
    expect(negotiateLocale('fr-FR')).toBe('es');
  });
});
