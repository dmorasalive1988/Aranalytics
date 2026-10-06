import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, HighlightCard, Notice, ScreenTitle, StatusPill, buttonClass } from '@pluma/ui';
import { BarChart3, CircleAlert, ChevronRight, TrendingUp } from 'lucide-react';
import { payouts, statements } from '@pluma/services';
import { PeriodBars } from '@/components/period-bars';
import { date, money } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';

export async function generateMetadata() {
  return { title: (await getTranslations('payments'))('title') };
}

/** A14 · Pagos: saldo (ledger), próximo statement oficial, historial, alertas y retiros. */
export default async function Payments() {
  const s = await requireMember();
  const t = await getTranslations('payments');
  const locale = await getLocale();
  const country = s.profile?.country;
  const [list, balance, next, alerts, myPayouts] = await Promise.all([
    statements.listMyStatements(deps(), s.userId),
    payouts.balanceCents(deps(), s.userId),
    statements.nextOfficialStatement(deps()),
    statements.writerAlerts(deps(), s.userId),
    payouts.myPayouts(deps(), s.userId),
  ]);
  const m = (c: number) => money(c, locale, country);
  const chart = [...list].reverse().slice(-6).map((x) => ({ key: x.code.replace(/^20(\d\d)-/, '$1·'), cents: Number(x.netCents) }));
  return (
    <>
      <ScreenTitle title={t('title')} />
      <HighlightCard className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">{t('balance')}</span>
        <span className="tabular text-[38px] font-bold tracking-[-0.02em]">{m(balance)}</span>
        <span className="text-[13px]">{t('nextStatement')}: {next ? `${next.code} · ${date(next.payDate, locale, country)}` : t('noCalendar')}</span>
        <div className="mt-2 flex gap-2.5">
          <Link href="/pagos/retirar" className={buttonClass({ variant: 'on-ambar', size: 'md' }) + ' flex-1'}>{t('withdraw')}</Link>
          {list[0] && <Link href={`/pagos/${list[0].id}`} className={buttonClass({ variant: 'on-ambar-outline', size: 'md' }) + ' flex-1'}>{list[0].code}</Link>}
        </div>
      </HighlightCard>

      {alerts.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="alerts">
          <h2 id="alerts" className="sr-only">{t('alerts')}</h2>
          {alerts.map((a, i) => (
            <Notice key={i} tone={a.kind === 'no_income' ? 'alert' : 'ok'} icon={a.kind === 'no_income' ? <CircleAlert size={20} strokeWidth={2} /> : <TrendingUp size={20} strokeWidth={2} />}
              title={a.kind === 'no_income' ? t('alertNoIncome', { title: a.title! }) : t('alertNewTerritory', { territory: new Intl.DisplayNames([locale], { type: 'region' }).of(a.territory!) ?? a.territory! })} />
          ))}
        </section>
      )}

      {chart.length > 0 && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold">{t('history')}</h2>
            <span className="text-xs text-fg-2">USD</span>
          </div>
          <PeriodBars data={chart} label={t('chartLabel')} format={m} />
          <Link href="/pagos/analitica" className="inline-flex items-center gap-1.5 self-start text-sm font-bold"><BarChart3 size={16} strokeWidth={2} aria-hidden />{t('analytics')}</Link>
        </Card>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="st">
        <h2 id="st" className="text-[15px] font-bold">{t('statements')}</h2>
        {list.length === 0 ? <p className="text-sm text-fg-2">{t('noStatements')}</p> : (
          <ul>
            {list.map((x) => (
              <li key={x.id}>
                <Link href={`/pagos/${x.id}`} className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-3 text-fg no-underline">
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{x.code}</span>
                    <span className="text-xs text-fg-2">{date(x.payDate, locale, country)}{Number(x.heldCents) > 0 && ` · ${t('held')} ${m(Number(x.heldCents))}`}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular font-bold">{m(Number(x.netCents))}</span>
                    <ChevronRight size={18} strokeWidth={2} className="text-fg-2" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {myPayouts.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="po">
          <h2 id="po" className="text-[15px] font-bold">{t('payouts')}</h2>
          <ul>
            {myPayouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 border-b border-line py-3">
                <span className="flex flex-col gap-0.5"><span className="text-sm">{p.label}</span><span className="text-xs text-fg-2">{date(p.requestedAt, locale, country)}</span></span>
                <span className="flex flex-col items-end gap-1">
                  <span className="tabular font-bold">{m(Number(p.amountCents))}</span>
                  <StatusPill tone={p.status === 'paid' ? 'verde' : p.status === 'failed' ? 'coral' : 'ambar'}>{t(`payoutStatus.${p.status}`)}</StatusPill>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
