import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, Notice, ScreenTitle, buttonClass, cn } from '@pluma/ui';
import { Check, Download, Lock, MapPin, Radio, Timer } from 'lucide-react';
import { analytics } from '@pluma/services';
import { BackLink } from '@/components/back-link';
import { Delta, Heatmap, RankedBars, Spark, StackedPeriods, TYPE_COLOR, type IncomeType } from '@/components/analytics-charts';
import { money, pct } from '@/lib/format';
import { hasAnalytics } from '@/lib/plan-features';
import { deps, requireMember } from '@/lib/server';

export async function generateMetadata() {
  return { title: (await getTranslations('analytics'))('title') };
}

/**
 * A19 · Analítica avanzada (solo Pro): de qué plataforma (DSP o sociedad) y de qué país viene cada dólar,
 * por tipo de ingreso y por obra, con cruce plataforma × país, tiempo hasta el pago, novedades y CSV.
 */
export default async function Analytics({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const s = await requireMember();
  const t = await getTranslations('analytics');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const country = s.profile?.country;
  const m = (c: number) => money(c, locale, country);
  const p = (bps: number) => pct(bps, locale, country);
  const back = <div className="lg:hidden"><BackLink href="/pagos" label={tc('back')} /></div>;

  if (!hasAnalytics(s.membership!)) {
    return (
      <>
        {back}
        <ScreenTitle title={t('title')} />
        <Notice tone="info" icon={<Lock size={20} strokeWidth={2} />} title={t('locked')}>
          <p className="mt-1">{t('lockedSub')}</p>
          <ul className="mt-3 flex flex-col gap-2">
            {(t.raw('lockedList') as string[]).map((x) => (
              <li key={x} className="flex gap-2"><Check size={18} strokeWidth={2.5} className="mt-0.5 shrink-0 text-ok-fg" aria-hidden />{x}</li>
            ))}
          </ul>
          <Link href="/cuenta/plan" className={buttonClass({ variant: 'outline-ambar', size: 'md' }) + ' mt-4'}>{(await getTranslations('workDetail'))('upgrade')}</Link>
        </Notice>
      </>
    );
  }

  const rows = await analytics.writerIncomeRows(deps(), s.userId);
  if (!rows.length) return (<>{back}<ScreenTitle title={t('title')} /><p className="text-sm text-fg-2">{t('noData')}</p></>);

  const { periodo = 'all' } = await searchParams;
  const sum = analytics.summarizeIncome(rows, periodo);
  const range = sum.selected.length === 1 && periodo !== 'all' ? periodo : 'all';
  const regions = new Intl.DisplayNames([locale], { type: 'region' });
  const countryName = (code: string) => regions.of(code) ?? code;
  const types = t.raw('types') as Record<IncomeType, string>;
  const src = analytics.sourceLabel;
  const topSource = sum.bySource[0];
  const topCountry = sum.byCountry[0];
  const chip = (active: boolean) => cn('inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold no-underline', active ? 'bg-ambar text-tinta' : 'bg-surface text-fg hover:bg-surface-2');

  return (
    <div data-wide className="flex flex-col gap-6 lg:gap-8">
      {back}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em] lg:text-[40px]">{t('title')}</h1>
          <p className="text-[15px] text-fg-3">{t('sub')}</p>
        </div>
        <a href={`/api/analitica${range === 'all' ? '' : `?periodo=${range}`}`} className={buttonClass({ variant: 'secondary', size: 'md' })}>
          <Download size={18} strokeWidth={2} aria-hidden />
          {t('download')}
        </a>
      </div>

      <nav aria-label={t('range')} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
        <Link href="/analitica" aria-current={range === 'all' ? 'page' : undefined} className={chip(range === 'all')}>{t('all')}</Link>
        {[...sum.periods].reverse().map((x) => (
          <Link key={x.code} href={`/analitica?periodo=${x.code}`} aria-current={range === x.code ? 'page' : undefined} className={chip(range === x.code)}>{x.code}</Link>
        ))}
      </nav>

      {/* Cifras clave */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-fg-2">{t('kpiTotal')}</span>
          <span className="tabular text-lg font-bold sm:text-2xl lg:text-[28px]">{m(sum.totalCents)}</span>
          <span className="text-xs text-fg-2">{range === 'all' ? `${sum.periods[0]!.code} – ${sum.periods.at(-1)!.code}` : range}</span>
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-fg-2">{t('kpiChange')}</span>
          <span className="tabular text-lg font-bold sm:text-2xl lg:text-[28px]">{m(sum.lastCents)}</span>
          {sum.prevTotalCents !== null ? <Delta cur={sum.lastCents} prev={sum.prevTotalCents} format={p} /> : <span className="text-xs text-fg-2">{t('noPrev')}</span>}
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-fg-2">{t('kpiTopSource')}</span>
          <span className="truncate text-xl font-bold lg:text-2xl">{topSource ? src(topSource.key) : '—'}</span>
          {topSource && <span className="text-xs text-fg-2">{t('ofTotal', { pct: p(Math.round(topSource.share * 10_000)) })}</span>}
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-fg-2">{t('kpiTopCountry')}</span>
          <span className="truncate text-xl font-bold lg:text-2xl">{topCountry ? countryName(topCountry.key) : '—'}</span>
          {topCountry && <span className="text-xs text-fg-2">{t('ofTotal', { pct: p(Math.round(topCountry.share * 10_000)) })}</span>}
        </Card>
      </div>

      {/* Tendencia por tipo de ingreso */}
      <Card className="flex flex-col gap-4 lg:p-6">
        <h2 className="text-[17px] font-bold">{t('trend')}</h2>
        <StackedPeriods periods={sum.periods} labels={types} format={m} caption={t('trend')} />
      </Card>

      {/* Plataformas y países */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 lg:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 text-[17px] font-bold"><Radio size={18} strokeWidth={2} className="text-ambar" aria-hidden />{t('bySource')}</h2>
            <p className="text-xs text-fg-2">{t('bySourceNote')}</p>
          </div>
          <RankedBars items={sum.bySource.map((x) => ({ ...x, label: src(x.key) }))} format={m} pct={p} none={t('noneLast')} />
        </Card>
        <Card className="flex flex-col gap-4 lg:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 text-[17px] font-bold"><MapPin size={18} strokeWidth={2} className="text-ambar" aria-hidden />{t('byCountry')}</h2>
            <p className="text-xs text-fg-2">{t('byCountryNote')}</p>
          </div>
          <RankedBars items={sum.byCountry.map((x) => ({ ...x, label: countryName(x.key) }))} format={m} pct={p} none={t('noneLast')} />
        </Card>
      </div>

      {/* Cruce plataforma × país */}
      <Card className="flex flex-col gap-4 lg:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-bold">{t('matrix')}</h2>
          <p className="text-xs text-fg-2">{t('matrixNote')}</p>
        </div>
        <Heatmap rows={sum.matrix.sources} cols={sum.matrix.countries} cells={sum.matrix.cells} rowLabel={src} colLabel={(c) => c} format={m} corner={`${t('bySource')} / ${t('byCountry')}`} />
      </Card>

      {/* Tipo de ingreso, del bruto al neto, tiempo hasta el pago y novedades */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-4 lg:p-6">
          <h2 className="text-[17px] font-bold">{t('byType')}</h2>
          <RankedBars items={sum.byType.map((x) => ({ ...x, label: types[x.key as IncomeType] ?? x.key, color: TYPE_COLOR[x.key as IncomeType] }))} format={m} pct={p} none={t('noneLast')} />
        </Card>
        <Card className="flex flex-col gap-3 lg:p-6">
          <h2 className="text-[17px] font-bold">{t('flow')}</h2>
          <dl className="flex flex-col text-sm">
            {[
              [t('gross'), m(sum.grossCents)],
              [t('commission'), `−${m(sum.commissionCents)}`],
              ...(sum.withholdingCents ? [[t('withholding'), `−${m(sum.withholdingCents)}`]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line py-2.5"><dt className="text-fg-3">{k}</dt><dd className="tabular">{v}</dd></div>
            ))}
            <div className="flex justify-between py-2.5 text-[15px] font-bold"><dt>{t('net')}</dt><dd className="tabular text-accent-fg">{m(sum.totalCents)}</dd></div>
          </dl>
        </Card>
        <Card className="flex flex-col gap-4 lg:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-center gap-2 text-[17px] font-bold"><Timer size={18} strokeWidth={2} className="text-ambar" aria-hidden />{t('lag')}</h2>
            <span className="tabular text-2xl font-bold">{sum.avgLagDays !== null ? t('lagValue', { days: sum.avgLagDays }) : '—'}</span>
            <p className="text-xs leading-relaxed text-fg-2">{t('lagNote')}</p>
          </div>
          <div className="flex flex-col gap-2 border-t border-line pt-3">
            <h3 className="text-sm font-bold">{t('insights')}</h3>
            {sum.newCountries.length + sum.newSources.length === 0 ? (
              <p className="text-xs text-fg-2">{t('noInsights')}</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {sum.newSources.map((x) => <li key={x} className="text-ok-fg">+ {t('newSource', { name: src(x) })}</li>)}
                {sum.newCountries.map((x) => <li key={x} className="text-ok-fg">+ {t('newCountry', { name: countryName(x) })}</li>)}
              </ul>
            )}
          </div>
        </Card>
      </div>

      {/* Por obra */}
      <section aria-labelledby="by-work" className="flex flex-col gap-3">
        <h2 id="by-work" className="text-[17px] font-bold">{t('byWork')}</h2>
        <div className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
          <table className="w-full min-w-[640px] overflow-hidden rounded-[20px] bg-surface text-left text-sm">
            <thead className="text-xs text-fg-2">
              <tr className="border-b border-line">
                <th scope="col" className="px-5 py-3 font-medium">{t('colWork')}</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">{t('colNet')}</th>
                <th scope="col" className="px-5 py-3 text-right font-medium">{t('colShare')}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t('colTopSource')}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t('colTopCountry')}</th>
                <th scope="col" className="px-5 py-3 font-medium">{t('colTrend')}</th>
              </tr>
            </thead>
            <tbody>
              {sum.byWork.map((w) => (
                <tr key={w.key} className="border-b border-line last:border-0">
                  <td className="px-5 py-3.5 font-medium">{w.workId ? <Link href={`/obras/${w.workId}`} className="text-fg no-underline hover:text-ambar">{w.key}</Link> : w.key}</td>
                  <td className="tabular px-5 py-3.5 text-right font-bold">{m(w.cents)}</td>
                  <td className="tabular px-5 py-3.5 text-right text-fg-3">{p(Math.round(w.share * 10_000))}</td>
                  <td className="px-5 py-3.5 text-fg-3">{w.topSource ? src(w.topSource) : '—'}</td>
                  <td className="px-5 py-3.5 text-fg-3">{w.topCountry ? countryName(w.topCountry) : '—'}</td>
                  <td className="px-5 py-3.5"><span className="flex items-center gap-2"><Spark values={w.trend} /><Delta cur={w.lastCents} prev={w.prevCents} format={p} none={t('noneLast')} /></span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {sum.projectionCents !== null && (
        <p className="text-sm text-fg-2">
          <strong className="text-fg">{t('projection')}: ≈ {m(sum.projectionCents)}.</strong> {t('projectionNote')}
        </p>
      )}
    </div>
  );
}
