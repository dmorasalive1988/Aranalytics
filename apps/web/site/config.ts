/** Constantes del sitio sin textos: se pueden usar en componentes de cliente sin cargar el diccionario. */
/** Idiomas del sitio público (segmento de la URL). Inglés y portugués se agregan tras revisar el español. */
export const SITE_LANGS = ['es'] as const;
export type SiteLang = 'es' | 'en' | 'pt';

/** Formato de números: miles con punto en español y portugués, con coma en inglés. */
export const NUMBER_LOCALE: Record<SiteLang, string> = { es: 'es-CO', en: 'en-US', pt: 'pt-BR' };

/** Reemplaza {nombre} en un texto. */
export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Rutas de las páginas legales en cada idioma. */
export const LEGAL_SLUGS: Record<SiteLang, Record<'terms' | 'privacy' | 'contract', string>> = {
  es: { terms: 'terminos', privacy: 'privacidad', contract: 'contrato' },
  en: { terms: 'terms', privacy: 'privacy', contract: 'contract' },
  pt: { terms: 'termos', privacy: 'privacidade', contract: 'contrato' },
};
