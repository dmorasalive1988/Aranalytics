import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { CookieNotice } from '@/site/components/cookie-notice';
import { Enhancements } from '@/site/components/enhancements';
import { HTML_LANG, SITE_LANGS, dict, isSiteLang, siteUrl } from '@/site/i18n';
import { display, sans } from '@/site/fonts';
import { alternates } from '@/site/seo';
import '../../globals.css';

/** Sitio público: páginas estáticas por idioma (/es, /en, /pt), con su propio layout raíz. */
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGS.map((lang) => ({ lang }));
}

export const viewport: Viewport = { themeColor: '#0E1020', width: 'device-width', initialScale: 1 };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isSiteLang(lang)) return {};
  const d = dict(lang);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: d.meta.title, template: '%s · Pluma' },
    description: d.meta.description,
    keywords: d.meta.keywords,
    applicationName: 'Pluma',
    alternates: alternates(lang, () => ''),
    openGraph: { type: 'website', siteName: 'Pluma', locale: HTML_LANG[lang].replace('-', '_'), title: d.meta.title, description: d.meta.description, url: `/${lang}` },
    twitter: { card: 'summary_large_image', title: d.meta.title, description: d.meta.description },
  };
}

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSiteLang(lang)) notFound();
  const d = dict(lang);
  return (
    <html lang={HTML_LANG[lang]} className={`scroll-smooth site ${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-tinta text-papel antialiased">
        {/* Las animaciones de aparición solo se activan con JavaScript: sin él, todo el contenido está visible. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
        {children}
        <CookieNotice lang={lang} labels={d.cookies} />
        <Enhancements />
        {process.env.VERCEL && <script defer src="/_vercel/insights/script.js" />}
      </body>
    </html>
  );
}
