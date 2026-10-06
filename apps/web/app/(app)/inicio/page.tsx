import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { HighlightCard, Notice, StatusPill, buttonClass } from '@pluma/ui';
import { CircleAlert, PenLine, Users } from 'lucide-react';
import { listMyWorks, network, statements } from '@pluma/services';
import { WorkRow } from '@/components/work-row';
import { date, money, planName } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';
import { pendingForMe } from '@/lib/queries';

export async function generateMetadata() {
  return { title: (await getTranslations('nav'))('home') };
}

/** A13 · Inicio: saldo (desde el ledger), próximo statement oficial, firmas pendientes y obras. */
export default async function Home() {
  const s = await requireMember();
  const t = await getTranslations('home');
  const locale = await getLocale();
  const [works, pending, balanceCents, next, myReqs] = await Promise.all([listMyWorks(deps(), s.userId), pendingForMe(s.userId), balanceFor(s.userId), statements.nextOfficialStatement(deps()), network.myRequests(deps(), s.userId)]);
  const awaiting = myReqs.reduce((a, r) => a + r.pending, 0);
  const tn = await getTranslations('network');
  const name = s.profile?.artistName || s.profile?.legalName.split(' ')[0] || '';
  const m = s.membership!;
  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-fg-2">{t('hello')}</span>
          <h1 className="font-display text-2xl font-extrabold">{name}</h1>
        </div>
        <StatusPill tone={m.plan === 'pro' ? 'ambar' : 'niebla'}>{t('planPill', { plan: planName(m.plan, locale) })}</StatusPill>
      </div>

      {m.effectiveStatus === 'past_due' && m.currentPeriodEnd && (
        <Notice tone="alert" icon={<CircleAlert size={20} strokeWidth={2} />} title={t('graceNotice', { date: date(new Date(new Date(m.currentPeriodEnd).getTime() + 15 * 86_400_000), locale, s.profile?.country) })} />
      )}

      <HighlightCard className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium">{t('balance')}</span>
        <span className="tabular text-[38px] font-bold tracking-[-0.02em]">{money(balanceCents, locale, s.profile?.country)}</span>
        <span className="text-[13px]">{t('nextStatement')}: {next ? date(next.payDate, locale, s.profile?.country) : t('nextStatementValue')}</span>
        <Link href="/pagos" className="mt-1 text-[13px] font-bold text-tinta">{(await getTranslations('payments'))('statements')}</Link>
        {balanceCents === 0 && <span className="mt-1 text-[13px] leading-snug">{t('noStatementYet')}</span>}
      </HighlightCard>

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

      <section className="flex flex-col gap-2" aria-labelledby="works-title">
        <div className="flex items-center justify-between">
          <h2 id="works-title" className="text-[15px] font-bold">{t('worksTitle')}</h2>
          {works.length > 0 && <Link href="/obras" className="text-sm font-bold">{t('seeAll')}</Link>}
        </div>
        {works.length === 0 ? (
          <p className="text-sm leading-relaxed text-fg-2">{t('emptyWorks')}</p>
        ) : (
          <ul>{works.slice(0, 4).map((w) => <WorkRow key={w.id} w={w} />)}</ul>
        )}
        <Link href="/obras/nueva" className={buttonClass({ block: true })}>{t('registerWork')}</Link>
      </section>
    </>
  );
}

async function balanceFor(userId: string) {
  const { withUser, t } = await import('@pluma/db');
  const rows = await withUser(deps().db, userId, (tx) => tx.select().from(t.writerBalances));
  return rows.reduce((acc, r) => acc + Number(r.balanceCents ?? 0), 0);
}
