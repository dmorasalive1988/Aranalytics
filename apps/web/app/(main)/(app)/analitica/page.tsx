import { getLocale, getTranslations } from 'next-intl/server';
import { Card, ScreenTitle, cn } from '@pluma/ui';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { statements } from '@pluma/services';
import { BackLink } from '@/components/back-link';
import { PeriodBars } from '@/components/period-bars';
import { money, pct } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';

/** A19 · Analítica de regalías (todos los planes): tendencia por obra, comparación entre períodos y proyección marcada como estimado. */
export async function generateMetadata() {
  return { title: (await getTranslations('analytics'))('title') };
}

export default async function Analytics() {
  const s = await requireMember();
  const t = await getTranslations('analytics');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const country = s.profile?.country;
  const m = (c: number) => money(c, locale, country);
  const rows = await statements.writerIncomeByWork(deps(), s.userId);
  const periods = [...new Map(rows.map((r) => [r.period, r.pay_date])).keys()];
  if (!periods.length) return (<><div className="lg:hidden"><BackLink href="/pagos" label={tc('back')} /></div><ScreenTitle title={t('title')} /><p className="text-sm text-fg-2">{t('noData')}</p></>);
  const cents = (v: string) => Math.round(Number(v) * 100);
  const totalBy = (p: string) => rows.filter((r) => r.period === p).reduce((a, r) => a + cents(r.net), 0);
  const last = periods.at(-1)!;
  const prev = periods.at(-2);
  const lastTotal = totalBy(last);
  const prevTotal = prev ? totalBy(prev) : null;
  const change = prevTotal ? Math.round(((lastTotal - prevTotal) / Math.abs(prevTotal)) * 10000) : null;
  const recent = periods.slice(-3).map(totalBy);
  const projection = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
  const works = [...new Set(rows.map((r) => r.title))];
  return (
    <>
      <div className="lg:hidden"><BackLink href="/pagos" label={tc('back')} /></div>
      <ScreenTitle title={t('title')} />
      <div className="grid grid-cols-2 gap-3">
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-fg-2">{t('compare')}</span>
          <span className="tabular text-xl font-bold">{m(lastTotal)}</span>
          {change !== null && (
            <span className={cn('inline-flex items-center gap-1 text-xs font-bold', change >= 0 ? 'text-ok-fg' : 'text-danger-fg')}>
              {change >= 0 ? <TrendingUp size={14} strokeWidth={2} aria-hidden /> : <TrendingDown size={14} strokeWidth={2} aria-hidden />}
              {t('change', { pct: pct(change, locale, country) })}
            </span>
          )}
        </Card>
        <Card className="flex flex-col gap-1">
          <span className="text-[13px] text-fg-2">{t('projection')}</span>
          <span className="tabular text-xl font-bold">≈ {m(projection)}</span>
          <span className="text-xs leading-snug text-fg-2">{t('projectionNote')}</span>
        </Card>
      </div>
      <h2 className="text-[15px] font-bold">{t('byWork')}</h2>
      {works.map((w) => (
        <Card key={w} className="flex flex-col gap-3">
          <h3 className="font-medium">{w}</h3>
          <PeriodBars data={periods.map((p) => ({ key: p.replace(/^20(\d\d)-/, '$1·'), cents: cents(rows.find((r) => r.period === p && r.title === w)?.net ?? '0') }))} label={w} format={m} />
        </Card>
      ))}
    </>
  );
}
