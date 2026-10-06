import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowRight, Disc3, Headphones, PenLine, Search } from 'lucide-react';
import { buttonClass } from '@pluma/ui';
import { Eyebrow, H2, Reveal, Section } from '@/site/components/common';
import { SiteHeader } from '@/site/components/header';
import { LeadForm } from '@/site/components/lead-form';
import { SiteFooter } from '@/site/components/sections';
import { SyncSearch } from '@/site/components/sync-search';
import { dict, isSiteLang } from '@/site/i18n';
import { alternates } from '@/site/seo';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isSiteLang(lang)) return {};
  const d = dict(lang);
  return { title: { absolute: d.meta.syncTitle }, description: d.meta.syncDescription, alternates: alternates(lang, () => '/sync'), openGraph: { title: d.meta.syncTitle, description: d.meta.syncDescription, url: `/${lang}/sync` } };
}

const STEP_ICONS = [Search, PenLine, Headphones];

/** /sync: para supervisores, agencias y productoras: buscador de muestra, cómo licenciar y contacto. */
export default async function SyncBuyers({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSiteLang(lang)) notFound();
  const d = dict(lang);
  const s = d.syncPage;
  return (
    <>
      <SiteHeader d={d} lang={lang} home={false} pathFor={() => '/sync'} />
      <main id="contenido">
        <Section labelledBy="sync-buyers-title" className="lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-16">
            <div className="flex flex-col gap-6">
              <Eyebrow>{s.eyebrow}</Eyebrow>
              <h1 id="sync-buyers-title" className="font-display text-[44px] leading-[1] font-extrabold tracking-[-0.04em] text-balance sm:text-[60px] lg:text-[72px]">{s.title}</h1>
              <p className="text-[17px] leading-relaxed text-fg-3 lg:text-lg">{s.sub}</p>
              <div className="flex flex-wrap gap-3">
                <a href="/pluma-sync" data-track="buyer_portal" className={buttonClass()}>
                  {s.portal}
                  <ArrowRight size={18} aria-hidden />
                </a>
                <a href="#contacto" className={buttonClass({ variant: 'secondary' })}>{s.contactCta}</a>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-display text-2xl font-extrabold">{s.searchTitle}</h2>
                <p className="text-[15px] text-fg-3">{s.searchSub}</p>
              </div>
              <SyncSearch labels={s} />
            </div>
          </div>
        </Section>

        <Section tone="noche" labelledBy="how-license">
          <Reveal className="flex flex-col gap-5">
            <H2 id="how-license">{s.howTitle}</H2>
          </Reveal>
          <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
            {s.how.map((step, i) => {
              const Icon = STEP_ICONS[i]!;
              return (
                <Reveal as="li" key={step.title} delay={i * 80} className="flex flex-col gap-3 border-t-2 border-ambar pt-6">
                  <span className="flex items-center gap-3">
                    <span className="tabular font-display text-lg font-extrabold text-ambar">0{i + 1}</span>
                    <Icon size={24} strokeWidth={2} className="text-ambar" aria-hidden />
                  </span>
                  <h3 className="font-display text-2xl font-extrabold">{step.title}</h3>
                  <p className="leading-relaxed text-fg-3">{step.body}</p>
                </Reveal>
              );
            })}
          </ol>
          <Reveal className="mt-12 flex gap-4 rounded-[24px] bg-ambar p-6 text-tinta sm:p-8">
            <Disc3 size={28} strokeWidth={2} className="mt-1 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-2xl font-extrabold">{s.oneStopTitle}</h3>
              <p className="text-[17px] leading-relaxed">{s.oneStopBody}</p>
            </div>
          </Reveal>
        </Section>

        <Section id="contacto" labelledBy="sync-form-title">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div className="flex flex-col gap-4">
              <H2 id="sync-form-title" className="lg:text-[56px]">{s.formTitle}</H2>
              <p className="text-[17px] leading-relaxed text-fg-3">{s.formSub}</p>
            </div>
            <LeadForm kind="sync" lang={lang} labels={d.forms} />
          </div>
        </Section>
      </main>
      <SiteFooter d={d} lang={lang} home={false} pathFor={() => '/sync'} />
    </>
  );
}
