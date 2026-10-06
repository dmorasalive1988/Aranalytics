import { ArrowRight, AudioLines, BadgeCheck, Check, CircleDollarSign, Clapperboard, DoorClosed, Ear, FileSpreadsheet, LayoutDashboard, MessageSquareWarning, PenLine, Scale, Signature, Stamp, Users, Wallet, BellRing, Disc3, Handshake } from 'lucide-react';
import { PlumaLogo, PlumaSymbol, buttonClass, cn } from '@pluma/ui';
import { LEGAL_SLUGS, WAITLIST_ID, registerHref, waitlistOn, type SiteDict, type SiteLang } from '../i18n';
import { Eyebrow, ExampleTag, H2, Marked, Reveal, Section } from './common';
import { LangSwitch, SECTION_LINKS } from './header';
import { WaitlistForm } from './waitlist';
import { AnalyticsMock, DashboardMock, LicenseMock, RequestCardMock, StatementMock } from './mockups';

type P = { d: SiteDict; lang: SiteLang };

/** Pluma grande y recortada (hero y cierre): tono sobre tono, sin degradados. */
function BigFeather({ className }: { className?: string }) {
  return <PlumaSymbol size={880} barColor="#23263D" quillColor="#1B1E33" className={cn('pointer-events-none absolute select-none', className)} />;
}

/* 1 · Hero */
export function Hero({ d, lang }: P) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-tinta">
      <BigFeather className="-right-[420px] top-[360px] sm:-right-72 lg:-top-24 lg:-right-56" />
      <div className="relative mx-auto grid w-full max-w-[1200px] gap-8 px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12 lg:pt-20 lg:pb-24">
        <div className="order-1 flex flex-col gap-5 lg:gap-7">
          <h1 id="hero-title" className="font-display text-[46px] leading-[0.98] font-extrabold tracking-[-0.04em] text-balance sm:text-[64px] lg:text-[80px]">
            {d.hero.title}
          </h1>
          <p className="max-w-[580px] text-[17px] leading-relaxed text-fg-3 lg:text-[20px]">{d.hero.sub}</p>
          <div className="flex flex-wrap gap-3">
            <a href={registerHref(lang)} data-track="signup_click:hero" className={buttonClass()}>
              {d.hero.join}
            </a>
            <a href="#precios" className={buttonClass({ variant: 'secondary' })}>
              {d.hero.plans}
            </a>
          </div>
        </div>
        <ul className="order-2 flex flex-col gap-2 text-[15px] font-medium sm:flex-row sm:flex-wrap sm:gap-x-6 lg:order-3 lg:col-span-2 lg:justify-center lg:border-t lg:border-line lg:pt-8 lg:text-[17px]">
          {d.hero.facts.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <Check size={18} strokeWidth={2.5} className="shrink-0 text-ambar" aria-hidden />
              {f}
            </li>
          ))}
        </ul>
        <div className="order-3 flex flex-col items-center gap-3 lg:order-2">
          <DashboardMock d={d} />
          <ExampleTag>{d.example}</ExampleTag>
        </div>
      </div>
    </section>
  );
}

/* 2 · El problema */
const PROBLEM_ICONS = [CircleDollarSign, MessageSquareWarning, DoorClosed];
export function Problem({ d }: P) {
  return (
    <Section tone="noche" labelledBy="problem-title">
      <Reveal className="flex max-w-[860px] flex-col gap-5">
        <Eyebrow>{d.problem.eyebrow}</Eyebrow>
        <H2 id="problem-title">{d.problem.title}</H2>
      </Reveal>
      <ul className="mt-12 grid gap-4 md:grid-cols-3 lg:mt-16">
        {d.problem.cards.map((c, i) => {
          const Icon = PROBLEM_ICONS[i]!;
          return (
            <Reveal as="li" key={c.title} delay={i * 80} className="flex flex-col gap-4 rounded-[20px] bg-surface p-6">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-alerta text-coral">
                <Icon size={24} strokeWidth={2} aria-hidden />
              </span>
              <h3 className="font-display text-2xl font-extrabold">{c.title}</h3>
              <p className="leading-relaxed text-fg-3">{c.body}</p>
            </Reveal>
          );
        })}
      </ul>
    </Section>
  );
}

/* 3 · Cómo funciona */
const STEP_ICONS = [PenLine, Signature, Wallet];
export function HowItWorks({ d }: P) {
  return (
    <Section id="como-funciona" labelledBy="how-title">
      <Reveal className="flex flex-col gap-5">
        <Eyebrow>{d.how.eyebrow}</Eyebrow>
        <H2 id="how-title" className="lg:text-[80px]">
          {d.how.title}
        </H2>
      </Reveal>
      <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-6 lg:mt-16">
        {d.how.steps.map((s, i) => {
          const Icon = STEP_ICONS[i]!;
          return (
            <Reveal as="li" key={s.title} delay={i * 80} className="flex flex-col gap-4 border-t-2 border-ambar pt-6">
              <span className="flex items-center gap-3">
                <span className="tabular font-display text-lg font-extrabold text-ambar">0{i + 1}</span>
                <Icon size={26} strokeWidth={2} className="text-ambar" aria-hidden />
              </span>
              <h3 className="font-display text-[32px] leading-none font-extrabold">{s.title}</h3>
              <p className="text-[17px] leading-relaxed text-fg-3">{s.body}</p>
            </Reveal>
          );
        })}
      </ol>
    </Section>
  );
}

/* 4 · Red Pluma */
const PROTECT_ICONS = [AudioLines, Ear, Stamp];
export function Network({ d }: P) {
  const n = d.network;
  return (
    <Section id="red" tone="noche" labelledBy="network-title">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal className="flex flex-col gap-6">
          <Eyebrow>{n.eyebrow}</Eyebrow>
          <H2 id="network-title">{n.title}</H2>
          <p className="text-[17px] leading-relaxed text-fg-3 lg:text-lg">{n.body}</p>
          <p className="flex gap-3 rounded-[20px] bg-ambar p-5 text-[17px] leading-relaxed font-bold text-tinta">
            <Handshake size={26} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
            {n.differentiator}
          </p>
        </Reveal>
        <div className="flex flex-col gap-3">
          <ul aria-label={n.cardsLabel} className="flex flex-col gap-3">
            {n.cards.map((c, i) => (
              <Reveal as="li" key={c.title} delay={i * 80} className={cn(i === 1 && 'lg:ml-10', i === 2 && 'lg:ml-5')}>
                <RequestCardMock c={c} featured={i === 0} />
              </Reveal>
            ))}
          </ul>
          <ExampleTag>{d.example}</ExampleTag>
        </div>
      </div>
      <Reveal className="mt-16 flex flex-col gap-6 lg:mt-24">
        <h3 className="font-display text-[28px] font-extrabold">{n.protectionTitle}</h3>
        <ul className="grid gap-4 md:grid-cols-3">
          {n.protection.map((p, i) => {
            const Icon = PROTECT_ICONS[i]!;
            return (
              <li key={p.title} className="flex gap-4 rounded-[20px] bg-surface p-5">
                <Icon size={24} strokeWidth={2} className="mt-0.5 shrink-0 text-ambar" aria-hidden />
                <span className="flex flex-col gap-1">
                  <strong className="font-bold">{p.title}</strong>
                  <span className="text-[15px] leading-relaxed text-fg-3">
                    <Marked text={p.body} />
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </Section>
  );
}

/* 5 · Sync */
const SYNC_ICONS = [Clapperboard, Disc3, BadgeCheck];
export function Sync({ d }: P) {
  const s = d.sync;
  return (
    <Section id="sync" labelledBy="sync-title">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
        <div className="flex flex-col gap-8">
          <Reveal className="flex flex-col gap-5">
            <Eyebrow>{s.eyebrow}</Eyebrow>
            <H2 id="sync-title">{s.title}</H2>
          </Reveal>
          <ul className="flex flex-col gap-6">
            {s.points.map((p, i) => {
              const Icon = SYNC_ICONS[i]!;
              return (
                <Reveal as="li" key={p.title} delay={i * 80} className="flex gap-4">
                  <Icon size={26} strokeWidth={2} className="mt-1 shrink-0 text-ambar" aria-hidden />
                  <span className="flex flex-col gap-1">
                    <strong className="font-display text-xl font-extrabold">{p.title}</strong>
                    <span className="text-[17px] leading-relaxed text-fg-3">{p.body}</span>
                  </span>
                </Reveal>
              );
            })}
          </ul>
        </div>
        <Reveal className="flex flex-col items-center gap-3">
          <LicenseMock d={d} />
          <ExampleTag>{d.example}</ExampleTag>
        </Reveal>
      </div>
      <Reveal className="mt-16 flex flex-col gap-5 rounded-[24px] border border-stroke p-6 sm:p-8 lg:mt-24 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-[640px] flex-col gap-2">
          <h3 className="font-display text-2xl font-extrabold sm:text-[28px]">{s.buyerTitle}</h3>
          <p className="leading-relaxed text-fg-3">{s.buyerBody}</p>
        </div>
        <a href="/pluma-sync" data-track="buyer_click:sync" className={cn(buttonClass({ variant: 'outline-ambar' }), 'shrink-0')}>
          {s.buyerCta}
          <ArrowRight size={18} aria-hidden />
        </a>
      </Reveal>
    </Section>
  );
}

/* 6 · Administración global y transparencia */
const TRANSP_ICONS = [LayoutDashboard, FileSpreadsheet, BellRing];
export function Transparency({ d }: P) {
  const t = d.transparency;
  return (
    <Section tone="noche" labelledBy="transparency-title">
      <Reveal className="flex max-w-[900px] flex-col gap-5">
        <Eyebrow>{t.eyebrow}</Eyebrow>
        <H2 id="transparency-title">{t.title}</H2>
        <p className="text-[17px] leading-relaxed text-fg-3 lg:text-lg">{t.body}</p>
      </Reveal>
      <ul className="mt-10 grid gap-6 md:grid-cols-3">
        {t.points.map((p, i) => {
          const Icon = TRANSP_ICONS[i]!;
          return (
            <Reveal as="li" key={p.title} delay={i * 80} className="flex gap-4">
              <Icon size={24} strokeWidth={2} className="mt-0.5 shrink-0 text-ambar" aria-hidden />
              <span className="flex flex-col gap-1">
                <strong className="font-bold">{p.title}</strong>
                <span className="text-[15px] leading-relaxed text-fg-3">{p.body}</span>
              </span>
            </Reveal>
          );
        })}
      </ul>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:mt-16">
        <Reveal>
          <AnalyticsMock d={d} />
        </Reveal>
        <Reveal delay={80} className="flex flex-col gap-4">
          <StatementMock d={d} />
          <ExampleTag>{d.example}</ExampleTag>
        </Reveal>
      </div>
    </Section>
  );
}

/* 7 · Splits, explicados */
const SPLIT_COLORS = ['bg-ambar', 'bg-coral', 'bg-verde', 'bg-niebla'];
const SPLIT_ICONS = [Signature, Users, Scale];
export function Splits({ d }: P) {
  const s = d.splits;
  return (
    <Section labelledBy="splits-title">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Reveal className="flex flex-col gap-5">
          <Eyebrow>{s.eyebrow}</Eyebrow>
          <H2 id="splits-title">{s.title}</H2>
          <p className="text-[17px] leading-relaxed text-fg-3 lg:text-lg">{s.body}</p>
        </Reveal>
        <Reveal delay={80}>
          <figure className="flex flex-col gap-5 rounded-[24px] bg-noche p-5 sm:p-7">
            <figcaption className="flex flex-col gap-1">
              <span className="text-sm text-fg-2">{s.songLabel}</span>
              <span className="font-display text-2xl font-extrabold">{s.song}</span>
            </figcaption>
            <div className="flex h-14 overflow-hidden rounded-2xl" aria-hidden>
              {s.authors.map((a, i) => (
                <span key={a.name} className={cn('flex items-center justify-center text-[15px] font-bold text-tinta', SPLIT_COLORS[i])} style={{ width: `${a.pct}%` }}>
                  {a.pct}%
                </span>
              ))}
            </div>
            <p className="text-sm font-bold">{s.incomeLabel}</p>
            <ul className="flex flex-col">
              {s.authors.map((a, i) => (
                <li key={a.name} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
                  <span className="flex items-center gap-3">
                    <span className={cn('h-3.5 w-3.5 shrink-0 rounded-full', SPLIT_COLORS[i])} aria-hidden />
                    <span className="flex flex-col">
                      <span className="font-bold">{a.name}</span>
                      <span className="text-xs text-fg-2">{a.role}</span>
                    </span>
                  </span>
                  <span className="flex items-baseline gap-3">
                    <span className="tabular text-sm text-fg-2">{a.pct}%</span>
                    <span className="tabular font-bold">{a.amount}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-fg-2">{s.note}</p>
          </figure>
        </Reveal>
      </div>
      <ul className="mt-12 grid gap-4 md:grid-cols-3 lg:mt-16">
        {s.points.map((p, i) => {
          const Icon = SPLIT_ICONS[i]!;
          return (
            <Reveal as="li" key={p.title} delay={i * 80} className="flex flex-col gap-3 rounded-[20px] bg-noche p-6">
              <Icon size={26} strokeWidth={2} className="text-ambar" aria-hidden />
              <h3 className="font-display text-xl font-extrabold">{p.title}</h3>
              <p className="leading-relaxed text-fg-3">{p.body}</p>
            </Reveal>
          );
        })}
      </ul>
    </Section>
  );
}

/* 8 · Por qué Pluma */
export function Compare({ d }: P) {
  const c = d.compare;
  return (
    <Section tone="noche" labelledBy="compare-title">
      <Reveal className="flex max-w-[860px] flex-col gap-5">
        <Eyebrow>{c.eyebrow}</Eyebrow>
        <H2 id="compare-title">{c.title}</H2>
      </Reveal>
      <Reveal className="mt-12 lg:mt-16">
        <table className="w-full border-collapse text-left text-[15px] max-md:block">
          <thead className="max-md:sr-only">
            <tr>
              <th scope="col" className="w-[34%] px-4 pb-4 text-sm font-medium text-fg-2">{c.criterion}</th>
              {c.columns.map((col, i) => (
                <th key={col} scope="col" className={cn('px-4 pb-4 align-bottom', i === 0 ? 'rounded-t-2xl bg-ambar pt-4 font-display text-xl font-extrabold text-tinta' : 'text-sm font-bold text-fg-3')}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="max-md:flex max-md:flex-col max-md:gap-3">
            {c.rows.map((r, ri) => (
              <tr key={r[0]} className="border-t border-line max-md:flex max-md:flex-col max-md:rounded-[20px] max-md:border-0 max-md:bg-surface max-md:p-4">
                <th scope="row" className="px-4 py-4 font-bold max-md:p-0 max-md:pb-2 max-md:text-[17px]">{r[0]}</th>
                {r.slice(1).map((cell, i) => (
                  <td
                    key={i}
                    data-label={c.columns[i]}
                    className={cn(
                      'px-4 py-4 max-md:flex max-md:justify-between max-md:gap-4 max-md:px-0 max-md:py-1.5 max-md:before:text-fg-2 max-md:before:content-[attr(data-label)]',
                      i === 0 ? 'font-bold md:bg-ambar md:text-tinta max-md:text-ambar' : 'text-fg-3',
                      i === 0 && ri === c.rows.length - 1 && 'md:rounded-b-2xl',
                    )}
                  >
                    <span className="max-md:text-right">
                      <Marked text={cell} />
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Reveal>
    </Section>
  );
}

/* 11 · Para supervisores y A&Rs */
export function Audience({ d }: P) {
  const a = d.audience;
  const cols = [
    { ...a.sync, href: '/pluma-sync', track: 'buyer_click:band', Icon: Clapperboard },
    { ...a.ar, href: '/ar', track: 'ar_click:band', Icon: Disc3 },
  ];
  return (
    <Section tone="noche" labelledBy="audience-title" className="lg:py-24">
      <h2 id="audience-title" className="sr-only">{a.label}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {cols.map((c, i) => (
          <Reveal key={c.title} delay={i * 80} className="flex flex-col gap-4 rounded-[24px] bg-surface p-6 sm:p-8">
            <c.Icon size={28} strokeWidth={2} className="text-ambar" aria-hidden />
            <p className="text-sm text-fg-2">{c.eyebrow}</p>
            <h3 className="font-display text-[28px] leading-tight font-extrabold sm:text-[34px]">{c.title}</h3>
            <a href={c.href} data-track={c.track} className="mt-auto inline-flex min-h-11 items-center gap-2 self-start font-bold">
              {c.cta}
              <ArrowRight size={18} aria-hidden />
            </a>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* 12 · Cierre */
export function Closing({ d, lang }: P) {
  return (
    <section aria-labelledby="closing-title" className="relative overflow-hidden bg-tinta">
      <BigFeather className="-bottom-[420px] -left-72 lg:-bottom-80 lg:-left-40" />
      <Reveal className="relative mx-auto flex w-full max-w-[1200px] flex-col items-start gap-8 px-5 py-24 sm:px-8 lg:items-center lg:py-40 lg:text-center">
        <h2 id="closing-title" className="font-display text-[52px] leading-[0.98] font-extrabold tracking-[-0.04em] text-balance sm:text-[72px] lg:text-[96px]">
          {d.closing.title}
        </h2>
        <p className="font-display text-xl font-semibold text-ambar">{d.closing.tagline}</p>
        {waitlistOn() ? (
          <WaitlistForm id={WAITLIST_ID} lang={lang} labels={d.waitlist} plans={{ socio: d.pricing.plans.socio.name, pro: d.pricing.plans.pro.name }} />
        ) : (
          <a href={registerHref(lang)} data-track="signup_click:closing" className={buttonClass()}>
            {d.closing.join}
          </a>
        )}
      </Reveal>
    </section>
  );
}

/* 13 · Pie de página */
export function SiteFooter({ d, lang, home = true }: P & { home?: boolean }) {
  const f = d.footer;
  const legal = LEGAL_SLUGS[lang];
  return (
    <footer className="border-t border-line bg-tinta">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <PlumaLogo size={26} />
          <p className="font-display text-lg font-semibold text-ambar">{d.closing.tagline}</p>
          <LangSwitch lang={lang} d={d} />
        </div>
        <nav aria-label={f.sections} className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-fg-2">{f.sections}</h2>
          {SECTION_LINKS.map(([key, id]) => (
            <a key={id} href={home ? `#${id}` : `/${lang}#${id}`} className="inline-flex min-h-8 items-center text-fg-3 no-underline hover:text-papel">
              {d.nav[key]}
            </a>
          ))}
        </nav>
        <nav aria-label={f.forBuyers} className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-fg-2">{f.forBuyers}</h2>
          <a href="/pluma-sync" className="inline-flex min-h-8 items-center text-fg-3 no-underline hover:text-papel">{f.plumaSync}</a>
          <a href="/ar" className="inline-flex min-h-8 items-center text-fg-3 no-underline hover:text-papel">{f.arAccess}</a>
          <a href="/entrar" className="inline-flex min-h-8 items-center text-fg-3 no-underline hover:text-papel">{d.nav.login}</a>
        </nav>
        <nav aria-label={f.legal} className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-fg-2">{f.legal}</h2>
          <a href={`/${lang}/${legal.terms}`} className="inline-flex min-h-8 items-center text-fg-3 no-underline hover:text-papel">{f.terms}</a>
          <a href={`/${lang}/${legal.privacy}`} className="inline-flex min-h-8 items-center text-fg-3 no-underline hover:text-papel">{f.privacy}</a>
          <a href={`/${lang}/${legal.contract}`} className="inline-flex min-h-8 items-center text-fg-3 no-underline hover:text-papel">{f.contract}</a>
          <span className="text-fg-3">
            {f.contact}: <Marked text={f.contactValue} />
          </span>
          <span className="text-fg-3">
            {f.social}: <Marked text={f.socialValue} />
          </span>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto w-full max-w-[1200px] px-5 py-6 text-sm text-fg-2 sm:px-8">
          © {new Date().getFullYear()} <Marked text={f.company} />. {f.rights}
        </p>
      </div>
    </footer>
  );
}
