import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CalendarClock, Disc3, Signature } from 'lucide-react';
import { Eyebrow, Section } from '@/site/components/common';
import { SiteHeader } from '@/site/components/header';
import { LeadForm } from '@/site/components/lead-form';
import { SiteFooter } from '@/site/components/sections';
import { dict, isSiteLang } from '@/site/i18n';
import { alternates } from '@/site/seo';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isSiteLang(lang)) return {};
  const d = dict(lang);
  return { title: { absolute: d.meta.arTitle }, description: d.meta.arDescription, alternates: alternates(lang, () => '/ar'), openGraph: { title: d.meta.arTitle, description: d.meta.arDescription, url: `/${lang}/ar` } };
}

const ICONS = [Disc3, CalendarClock, Signature];

/** /ar: página corta para A&Rs con formulario de solicitud de acceso (el portal es solo por invitación). */
export default async function ArAccess({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isSiteLang(lang)) notFound();
  const d = dict(lang);
  const a = d.arPage;
  return (
    <>
      <SiteHeader d={d} lang={lang} home={false} pathFor={() => '/ar'} />
      <main id="contenido">
        <Section labelledBy="ar-title" className="lg:py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:gap-16">
            <div className="flex flex-col gap-6">
              <Eyebrow>{a.eyebrow}</Eyebrow>
              <h1 id="ar-title" className="font-display text-[44px] leading-[1] font-extrabold tracking-[-0.04em] text-balance sm:text-[60px] lg:text-[72px]">{a.title}</h1>
              <p className="text-[17px] leading-relaxed text-fg-3 lg:text-lg">{a.sub}</p>
              <ul className="mt-2 flex flex-col gap-5">
                {a.points.map((p, i) => {
                  const Icon = ICONS[i]!;
                  return (
                    <li key={p.title} className="flex gap-4">
                      <Icon size={24} strokeWidth={2} className="mt-0.5 shrink-0 text-ambar" aria-hidden />
                      <span className="flex flex-col gap-1">
                        <strong className="font-display text-xl font-extrabold">{p.title}</strong>
                        <span className="leading-relaxed text-fg-3">{p.body}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div id="acceso" className="flex flex-col gap-5 rounded-[24px] bg-noche p-6 sm:p-8">
              <div className="flex flex-col gap-2">
                <h2 className="font-display text-[32px] leading-tight font-extrabold">{a.formTitle}</h2>
                <p className="text-[15px] leading-relaxed text-fg-3">{a.formSub}</p>
              </div>
              <LeadForm kind="ar" lang={lang} labels={d.forms} />
              <a href="/ar" className="text-sm font-bold">{a.haveInvite}</a>
            </div>
          </div>
        </Section>
      </main>
      <SiteFooter d={d} lang={lang} home={false} pathFor={() => '/ar'} />
    </>
  );
}
