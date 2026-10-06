import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, HighlightCard, Notice, StatusPill, buttonClass } from '@pluma/ui';
import { BarChart3, CircleAlert, CircleCheck, PenLine, TrendingUp, Users } from 'lucide-react';
import { listMyWorks, network, statements } from '@pluma/services';
import { PeriodBars } from '@/components/period-bars';
import { WorkRow } from '@/components/work-row';
import { WorksTable } from '@/components/works-table';
import { date, money, planName } from '@/lib/format';
import { hasAnalytics } from '@/lib/plan-features';
import { deps, requireMember } from '@/lib/server';
import { pendingForMe } from '@/lib/queries';

export async function generateMetadata() {
  return { title: (await getTranslations('nav'))('home') };
}

/**
 * A13 · Inicio: saldo (desde el ledger), próximo statement oficial, firmas pendientes y obras.
 * En escritorio es un panel: cifras clave, ingresos por período, pendientes y tabla de obras.
 */
export default async function Home() {
  const s = await requireMember();
  const t = await getTranslations('home');
  const tp = await getTranslations('payments');
  const tn = await getTranslations('network');
  const locale = await getLocale();
  const country = s.profile?.country;
  const [works, pending, balanceCents, next, myReqs, myStatements, alerts] = await Promise.all([
    listMyWorks(deps(), s.userId),
    pendingForMe(s.userId),
    balanceFor(s.userId),
    statements.nextOfficialStatement(deps()),
    network.myRequests(deps(), s.userId),
    statements.listMyStatements(deps(), s.userId),
    statements.writerAlerts(deps(), s.userId),
  ]);
  const m = (c: number) => money(c, locale, country);
  const awaiting = myReqs.reduce((a, r) => a + r.pending, 0);
  const name = s.profile?.artistName || s.profile?.legalName.split(' ')[0] || '';
  const ms = s.membership!;
  const last = myStatements[0];
  const chart = [...myStatements].reverse().slice(-8).map((x) => ({ key: x.code.replace(/^20(\d\d)-/, '$1·'), cents: Number(x.netCents) }));
  const registered = works.filter((w) => w.status === 'registered').length;
  const regionName = (code: string) => new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  const hasTodo = pending.length > 0 || awaiting > 0 || alerts.length > 0;

  const todo = (
    <>
      {pending.length > 0 && (
        <Notice tone="alert" icon={<PenLine size={20} strokeWidth={2} />} title={pending.length === 1 ? t('pendingOne') : t('pendingMany', { count: pending.length })}>
          <Link href={`/obras/${pending[0]!.workId}`} className="font-bold">{t('review')}</Link>
        </Notice>
      )}
      {awaiting > 0 && (
        <Notice tone="info" icon={<Users size={20} strokeWidth={2} />} title={tn('activity')}>
          <Link href="/red/mis-solicitudes" className="font-bold">{tn('activityBody', { count: awaiting })}</Link>
        </Notice>
      )}
    </>
  );

  return (
    <div data-wide className="flex flex-col gap-6 lg:gap-8">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-fg-2 lg:text-sm">{t('hello')}</span>
          <h1 className="font-display text-2xl font-extrabold lg:text-[40px] lg:leading-tight">{name}</h1>
        </div>
        <span className="lg:hidden">
          <StatusPill tone={ms.plan === 'pro' ? 'ambar' : 'niebla'}>{t('planPill', { plan: planName(ms.plan, locale) })}</StatusPill>
        </span>
        <span className="hidden lg:block"><Link href="/obras/nueva" className={buttonClass({ size: 'md' })}>{t('registerWork')}</Link></span>
      </div>

      {ms.effectiveStatus === 'past_due' && ms.currentPeriodEnd && (
        <Notice tone="alert" icon={<CircleAlert size={20} strokeWidth={2} />} title={t('graceNotice', { date: date(new Date(new Date(ms.currentPeriodEnd).getTime() + 15 * 86_400_000), locale, country) })} />
      )}

      {/* Cifras clave: en el celular solo el saldo; en escritorio, cuatro tarjetas. */}
      <div className="grid gap-4 lg:grid-cols-4">
        <HighlightCard className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium">{t('balance')}</span>
          <span className="tabular text-[38px] font-bold tracking-[-0.02em] lg:text-[34px]">{m(balanceCents)}</span>
          <span className="text-[13px] lg:hidden">{t('nextStatement')}: {next ? date(next.payDate, locale, country) : t('nextStatementValue')}</span>
          <Link href="/pagos" className="mt-1 text-[13px] font-bold text-tinta">{tp('statements')}</Link>
          {balanceCents === 0 && <span className="mt-1 text-[13px] leading-snug lg:hidden">{t('noStatementYet')}</span>}
        </HighlightCard>
        <Card className="hidden flex-col gap-1.5 lg:flex">
          <span className="text-[13px] text-fg-2">{t('kpiLast')}</span>
          {last ? (
            <>
              <span className="tabular text-[28px] font-bold">{m(Number(last.netCents))}</span>
              <span className="text-[13px] text-fg-3">{last.code} · {date(last.payDate, locale, country)}</span>
            </>
          ) : (
            <span className="text-[15px] text-fg-3">{t('kpiLastNone')}</span>
          )}
        </Card>
        <Card className="hidden flex-col gap-1.5 lg:flex">
          <span className="text-[13px] text-fg-2">{t('nextStatement')}</span>
          <span className="text-xl font-bold">{next ? date(next.payDate, locale, country) : '—'}</span>
          <span className="text-[13px] text-fg-3">{next ? next.code : t('nextStatementValue')}</span>
        </Card>
        <Card className="hidden flex-col gap-1.5 lg:flex">
          <span className="text-[13px] text-fg-2">{t('kpiWorks')}</span>
          <span className="tabular text-[28px] font-bold">{registered}</span>
          <span className="text-[13px] text-fg-3">{t('kpiWorksSub', { count: works.length })}</span>
        </Card>
      </div>

      {/* Celular: los pendientes van aquí, como siempre. */}
      <div className="flex flex-col gap-3 lg:hidden">{todo}</div>

      {/* Escritorio: ingresos por período y pendientes lado a lado. */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-[1.6fr_1fr]">
        <Card className="flex flex-col gap-4 p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold">{tp('history')}</h2>
            <span className="text-xs text-fg-2">USD</span>
          </div>
          {chart.length ? <PeriodBars data={chart} label={tp('chartLabel')} format={m} /> : <p className="text-sm text-fg-2">{t('noStatementYet')}</p>}
          {hasAnalytics(ms) && <Link href="/analitica" className="inline-flex items-center gap-1.5 self-start text-sm font-bold"><BarChart3 size={16} strokeWidth={2} aria-hidden />{t('seeAnalytics')}</Link>}
        </Card>
        <section aria-labelledby="todo-title" className="flex flex-col gap-3">
          <h2 id="todo-title" className="text-[17px] font-bold">{t('todo')}</h2>
          {todo}
          {alerts.map((a, i) => (
            <Notice key={i} tone={a.kind === 'no_income' ? 'alert' : 'ok'} icon={a.kind === 'no_income' ? <CircleAlert size={20} strokeWidth={2} /> : <TrendingUp size={20} strokeWidth={2} />}
              title={a.kind === 'no_income' ? tp('alertNoIncome', { title: a.title! }) : tp('alertNewTerritory', { territory: regionName(a.territory!) })} />
          ))}
          {!hasTodo && <Notice tone="ok" icon={<CircleCheck size={20} strokeWidth={2} />} title={t('allClear')} />}
        </section>
      </div>

      <section className="flex flex-col gap-2 lg:gap-3" aria-labelledby="works-title">
        <div className="flex items-center justify-between">
          <h2 id="works-title" className="text-[15px] font-bold lg:text-[17px]">{t('worksTitle')}</h2>
          {works.length > 0 && <Link href="/obras" className="text-sm font-bold">{t('seeAll')}</Link>}
        </div>
        {works.length === 0 ? (
          <p className="text-sm leading-relaxed text-fg-2">{t('emptyWorks')}</p>
        ) : (
          <>
            <ul className="lg:hidden">{works.slice(0, 4).map((w) => <WorkRow key={w.id} w={w} />)}</ul>
            <div className="hidden lg:block"><WorksTable works={works.slice(0, 8)} /></div>
          </>
        )}
        <Link href="/obras/nueva" className={`${buttonClass({ block: true })} lg:hidden`}>{t('registerWork')}</Link>
      </section>
    </div>
  );
}

async function balanceFor(userId: string) {
  const { withUser, t } = await import('@pluma/db');
  const rows = await withUser(deps().db, userId, (tx) => tx.select().from(t.writerBalances));
  return rows.reduce((acc, r) => acc + Number(r.balanceCents ?? 0), 0);
}
