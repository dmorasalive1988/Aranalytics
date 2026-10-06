import { PlumaLogo, buttonClass } from '@pluma/ui';
import { SITE_LANGS, registerHref, type SiteDict, type SiteLang } from '../i18n';
import { MobileMenu } from './mobile-menu';

export const SECTION_LINKS = [
  ['how', 'como-funciona'],
  ['network', 'red'],
  ['sync', 'sync'],
  ['pricing', 'precios'],
  ['faq', 'faq'],
] as const;

/** Selector ES / EN / PT: enlaces a la misma página en cada idioma (el proxy recuerda la elección). */
export function LangSwitch({ lang, d, pathFor }: { lang: SiteLang; d: SiteDict; pathFor?: (l: SiteLang) => string }) {
  return (
    <nav aria-label={d.nav.language} className="flex items-center gap-1 text-sm">
      {(SITE_LANGS as readonly SiteLang[]).map((l) => (
        <a
          key={l}
          href={`/${l}${pathFor ? pathFor(l) : ''}`}
          hrefLang={l === 'pt' ? 'pt-BR' : l}
          lang={l === 'pt' ? 'pt-BR' : l}
          aria-current={l === lang ? 'true' : undefined}
          title={d.languages[l]}
          className={`inline-flex h-11 min-w-11 items-center justify-center rounded-xl px-2 font-bold uppercase no-underline ${l === lang ? 'text-ambar' : 'text-niebla hover:text-papel'}`}
        >
          <span aria-hidden>{l}</span>
          <span className="sr-only">{d.languages[l]}</span>
        </a>
      ))}
    </nav>
  );
}

/** Encabezado fijo: logo, secciones, idioma, iniciar sesión y "Hazte socio". */
export function SiteHeader({ lang, d, home = true, pathFor }: { lang: SiteLang; d: SiteDict; home?: boolean; pathFor?: (l: SiteLang) => string }) {
  const anchor = (id: string) => (home ? `#${id}` : `/${lang}#${id}`);
  const links = SECTION_LINKS.map(([key, id]) => ({ href: anchor(id), label: d.nav[key] }));
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-tinta/95 backdrop-blur-sm">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-ambar focus:px-3 focus:py-2 focus:text-tinta">
        {d.nav.skip}
      </a>
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-5 sm:px-8">
        <a href={`/${lang}`} aria-label={d.nav.home} className="no-underline">
          <PlumaLogo size={24} />
        </a>
        <nav aria-label={d.nav.main} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} className="inline-flex h-11 items-center rounded-xl px-3 text-[15px] font-medium text-fg-3 no-underline hover:text-papel">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <LangSwitch lang={lang} d={d} pathFor={pathFor} />
          </div>
          <a href="/entrar" className="hidden h-11 items-center rounded-xl px-3 text-[15px] font-bold text-papel no-underline hover:text-ambar sm:inline-flex">
            {d.nav.login}
          </a>
          <a href={registerHref(lang)} data-track="signup_click:header" className={buttonClass({ size: 'md' })}>
            {d.nav.join}
          </a>
          <MobileMenu labels={{ open: d.nav.menu, close: d.nav.close, login: d.nav.login, main: d.nav.main }} links={links}>
            <LangSwitch lang={lang} d={d} pathFor={pathFor} />
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
