import { notFound } from 'next/navigation';
import { SiteHeader } from '@/site/components/header';
import { Faq, Pricing } from '@/site/components/pricing';
import { Audience, Closing, Compare, Hero, HowItWorks, Network, Problem, SiteFooter, Splits, Sync, Transparency } from '@/site/components/sections';
import { dict, isSiteLang, siteUrl } from '@/site/i18n';
import { jsonLd } from '@/site/seo';

/** Home del sitio público: 13 secciones en el orden acordado. */
export default async function SiteHome({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSiteLang(lang)) notFound();
  const d = dict(lang);
  const p = { d, lang };
  return (
    <>
      <SiteHeader {...p} />
      <main id="contenido">
        <Hero {...p} />
        <Problem {...p} />
        <HowItWorks {...p} />
        <Network {...p} />
        <Sync {...p} />
        <Transparency {...p} />
        <Splits {...p} />
        <Compare {...p} />
        <Pricing {...p} />
        <Faq d={d} />
        <Audience {...p} />
        <Closing {...p} />
      </main>
      <SiteFooter {...p} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(d, siteUrl())).replace(/</g, '\\u003c') }} />
    </>
  );
}
