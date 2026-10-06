import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Marked } from '@/site/components/common';
import { SiteHeader } from '@/site/components/header';
import { SiteFooter } from '@/site/components/sections';
import { LEGAL_SLUGS, SITE_LANGS, dict, isSiteLang, type SiteLang } from '@/site/i18n';
import { alternates } from '@/site/seo';

type Kind = keyof (typeof LEGAL_SLUGS)['es'];
export const dynamicParams = false;

export function generateStaticParams() {
  return SITE_LANGS.flatMap((lang) => Object.values(LEGAL_SLUGS[lang]).map((legal) => ({ lang, legal })));
}

function kindOf(lang: SiteLang, slug: string) {
  return (Object.entries(LEGAL_SLUGS[lang]) as [Kind, string][]).find(([, s]) => s === slug)?.[0];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; legal: string }> }): Promise<Metadata> {
  const { lang, legal } = await params;
  if (!isSiteLang(lang)) return {};
  const kind = kindOf(lang, legal);
  if (!kind) return {};
  const d = dict(lang);
  return { title: d.meta.legalTitle[kind], description: d.meta.legalDescription, alternates: alternates(lang, (l) => `/${LEGAL_SLUGS[l][kind]}`), robots: { index: false } };
}

/** Términos, privacidad y contrato modelo: texto legal pendiente, sin contenido inventado. */
export default async function LegalPage({ params }: { params: Promise<{ lang: string; legal: string }> }) {
  const { lang, legal } = await params;
  if (!isSiteLang(lang)) notFound();
  const kind = kindOf(lang, legal);
  if (!kind) notFound();
  const d = dict(lang);
  return (
    <>
      <SiteHeader d={d} lang={lang} home={false} />
      <main id="contenido" className="mx-auto flex min-h-[60vh] w-full max-w-[760px] flex-col gap-8 px-5 py-16 sm:px-8 lg:py-24">
        <h1 className="font-display text-[40px] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[56px]">{d.meta.legalTitle[kind]}</h1>
        <p className="text-lg text-fg-3">
          <Marked text={d.legal.placeholder} />
        </p>
        <a href={`/${lang}`} className="font-bold">
          {d.legal.back}
        </a>
      </main>
      <SiteFooter d={d} lang={lang} home={false} />
    </>
  );
}
