import type { MetadataRoute } from 'next';
import { HTML_LANG, SITE_LANGS, siteUrl } from '@/site/i18n';

/** Sitio público por idioma, con sus alternativas hreflang. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const languages = Object.fromEntries(SITE_LANGS.map((l) => [HTML_LANG[l], `${base}/${l}`]));
  return SITE_LANGS.map((l) => ({ url: `${base}/${l}`, changeFrequency: 'weekly', priority: 1, alternates: { languages } }));
}
