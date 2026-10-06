import type { MetadataRoute } from 'next';
import { HTML_LANG, SITE_LANGS, siteUrl } from '@/site/i18n';

/** Sitio público por idioma (home, compradores de sync y A&Rs), con sus alternativas hreflang. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return (['', '/sync', '/ar'] as const).flatMap((path) => {
    const languages = Object.fromEntries(SITE_LANGS.map((l) => [HTML_LANG[l], `${base}/${l}${path}`]));
    return SITE_LANGS.map((l) => ({ url: `${base}/${l}${path}`, changeFrequency: 'weekly' as const, priority: path ? 0.7 : 1, alternates: { languages } }));
  });
}
