import { describe, expect, it } from 'vitest';
import en from '../site/en.json';
import es from '../site/es.json';
import pt from '../site/pt.json';

/** Rutas de todas las hojas (incluye índices de listas): los tres idiomas deben tener la misma forma. */
const paths = (o: unknown, p = ''): string[] =>
  Array.isArray(o) ? o.flatMap((v, i) => paths(v, `${p}${i}.`)) : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => paths(v, `${p}${k}.`)) : [p.slice(0, -1)];
const get = (o: unknown, path: string) => path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)[k], o);
const vars = (s: unknown) => (typeof s === 'string' ? [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort() : []);

describe('textos del sitio', () => {
  const base = paths(es).sort();
  it.each([['en', en], ['pt', pt]] as const)('%s tiene la misma estructura que es', (_, d) => {
    expect(paths(d).sort()).toEqual(base);
  });
  it.each([['en', en], ['pt', pt]] as const)('%s usa los mismos parámetros y no deja textos vacíos', (_, d) => {
    for (const k of base) {
      expect(vars(get(d, k)), k).toEqual(vars(get(es, k)));
      expect(String(get(d, k)).trim(), k).not.toBe('');
    }
  });
  it('ningún idioma nombra editoras o competidores', () => {
    for (const d of [es, en, pt]) expect(JSON.stringify(d)).not.toMatch(/warner|chappell|sony|universal|kobalt|songtrust|bmg|cd baby|tunecore|distrokid/i);
  });
});
