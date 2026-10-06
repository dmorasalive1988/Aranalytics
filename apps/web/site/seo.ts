import { HTML_LANG, SITE_LANGS, type SiteDict, type SiteLang } from './i18n';

/** Canonical y hreflang de una página; `path` da la ruta (sin idioma) en cada idioma. */
export function alternates(lang: SiteLang, path: (l: SiteLang) => string) {
  const languages: Record<string, string> = {};
  for (const l of SITE_LANGS) languages[HTML_LANG[l]] = `/${l}${path(l)}`;
  languages['x-default'] = `/es${path('es')}`;
  return { canonical: `/${lang}${path(lang)}`, languages };
}

/** Datos estructurados: organización y preguntas frecuentes (sin las respuestas aún marcadas como pendientes). */
export function jsonLd(d: SiteDict, url: string) {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Pluma',
    url,
    logo: `${url}/icon`,
    slogan: d.closing.tagline,
    description: d.meta.description,
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: d.faq.groups
      .flatMap((g) => g.items as [string, string][])
      .filter(([q, a]) => !/\[/.test(q) && !/\[/.test(a))
      .map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  return [org, faq];
}
