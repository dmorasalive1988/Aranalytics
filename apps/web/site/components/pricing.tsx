import { Check } from 'lucide-react';
import { DEFAULT_PLANS, breakEvenCents } from '@pluma/domain';
import { buttonClass, cn } from '@pluma/ui';
import { NUMBER_LOCALE, fmt, registerHref, type SiteDict, type SiteLang } from '../i18n';
import { Eyebrow, H2, Reveal, Section } from './common';
import { Calculator } from './calculator';
import { FaqTabs } from './faq';

export const usd = (cents: number, lang: SiteLang) => {
  const n = new Intl.NumberFormat(NUMBER_LOCALE[lang], { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100);
  return `${cents < 0 ? '−' : ''}USD ${n}`;
};

/* 9 · Precios (sección clara en Papel) */
export function Pricing({ d, lang }: { d: SiteDict; lang: SiteLang }) {
  const p = d.pricing;
  const be = breakEvenCents(DEFAULT_PLANS.socio, DEFAULT_PLANS.pro)!;
  return (
    <Section id="precios" tone="papel" labelledBy="pricing-title">
      <Reveal className="flex max-w-[860px] flex-col gap-5">
        <Eyebrow>{p.eyebrow}</Eyebrow>
        <H2 id="pricing-title">{p.title}</H2>
        <p className="text-[17px] leading-relaxed text-fg-2 lg:text-lg">{p.sub}</p>
      </Reveal>
      <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:mt-16">
        {(['socio', 'pro'] as const).map((code, i) => {
          const plan = DEFAULT_PLANS[code];
          const copy = p.plans[code];
          const pro = code === 'pro';
          return (
            <Reveal as="li" key={code} delay={i * 80} className={cn('flex flex-col gap-6 rounded-[24px] bg-white p-6 sm:p-8', pro ? 'ring-2 ring-tinta' : 'ring-1 ring-[#D9D3C7]')}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-[34px] leading-none font-extrabold">{copy.name}</h3>
                {pro && <span className="rounded-xl bg-tinta px-3 py-1.5 text-xs font-bold text-papel">{p.recommended}</span>}
              </div>
              <p className="flex flex-col gap-1">
                <span className="tabular font-display text-[44px] leading-none font-extrabold tracking-[-0.02em]">
                  {usd(plan.priceCents, lang)} <span className="font-sans text-base font-medium text-fg-2">{p.perYear}</span>
                </span>
                <span className="text-[15px] font-bold text-accent-fg">{fmt(p.commission, { pct: plan.commissionBps / 100 })}</span>
              </p>
              <ul className="flex flex-col gap-2.5">
                {copy.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[15px] leading-snug">
                    <Check size={18} strokeWidth={2.5} className="mt-0.5 shrink-0 text-ok-fg" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={registerHref(lang, code)}
                data-track={`plan_click:${code}`}
                className={cn(buttonClass({ variant: pro ? 'on-ambar' : 'on-ambar-outline', block: true }), 'mt-auto')}
              >
                {copy.cta}
              </a>
            </Reveal>
          );
        })}
      </ul>
      <Reveal className="mt-4">
        <Calculator
          lang={lang}
          labels={p.calc}
          breakEven={fmt(p.calc.breakEven, { amount: usd(be, lang) })}
          plans={{ socio: { priceCents: DEFAULT_PLANS.socio.priceCents, commissionBps: DEFAULT_PLANS.socio.commissionBps }, pro: { priceCents: DEFAULT_PLANS.pro.priceCents, commissionBps: DEFAULT_PLANS.pro.commissionBps } }}
        />
      </Reveal>
      <p className="mt-8 text-[17px] leading-relaxed font-bold">{p.note}</p>
    </Section>
  );
}

/* 10 · FAQ (también en Papel) */
export function Faq({ d }: { d: SiteDict }) {
  return (
    <Section id="faq" tone="papel" labelledBy="faq-title" className="pt-0 lg:pt-0">
      <div className="flex flex-col gap-10 border-t border-[#D9D3C7] pt-20 lg:pt-32">
        <Reveal className="flex max-w-[860px] flex-col gap-5">
          <Eyebrow>{d.faq.eyebrow}</Eyebrow>
          <H2 id="faq-title">{d.faq.title}</H2>
        </Reveal>
        <FaqTabs groups={d.faq.groups} />
      </div>
    </Section>
  );
}
