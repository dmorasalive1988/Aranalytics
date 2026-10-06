import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, Notice, StatusPill, buttonClass } from '@pluma/ui';
import { Download, FileText } from 'lucide-react';
import { statements } from '@pluma/services';
import { BackLink } from '@/components/back-link';
import { date, money, pct } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';

/** A15 · Statement oficial: el mismo modelo con el que se genera el PDF. */
export default async function Statement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireMember();
  const v = await statements.getMyStatement(deps(), s.userId, id);
  if (!v) notFound();
  const t = await getTranslations('statement');
  const tc = await getTranslations('common');
  const locale = s.locale;
  const country = s.profile?.country;
  const m = (c: number) => money(c, locale, country);
  const rows: [string, number, boolean?][] = [
    [t('opening'), v.totals.openingCents],
    [t('gross'), v.totals.grossCents],
    [t('commission', { pct: pct(v.plan.commissionBps, locale, country) }), 0 - v.totals.commissionCents || 0],
    [t('withholding'), 0 - v.totals.withholdingCents || 0],
    [t('net'), v.totals.netCents, true],
    [t('closing'), v.totals.closingCents, true],
  ];
  const group = (title: string, items: { key: string; netCents: number }[], label?: (k: string) => string) => (
    <Card className="flex flex-col gap-1">
      <h2 className="text-xs font-bold tracking-[0.1em] text-fg-2 uppercase">{title}</h2>
      <ul>{items.map((i) => <li key={i.key} className="flex justify-between gap-3 border-b border-line py-2.5 text-sm last:border-0"><span>{label ? label(i.key) : i.key}</span><span className="tabular font-bold">{m(i.netCents)}</span></li>)}</ul>
    </Card>
  );
  return (
    <>
      <BackLink href="/pagos" label={tc('back')} />
      <header className="flex flex-col gap-1">
        <span className="text-[13px] text-fg-2">{t('official')}</span>
        <h1 className="font-display text-[28px] font-extrabold tracking-[-0.02em]">{t('title', { period: v.periodCode })}</h1>
        <p className="text-sm text-fg-3">{t('payDate', { date: date(v.payDate, locale, country) })}</p>
      </header>
      <div className="flex flex-col gap-1.5 rounded-[20px] bg-ambar p-5 text-tinta">
        <span className="text-[13px] font-medium">{t('net')}</span>
        <span className="tabular text-[38px] font-bold tracking-[-0.02em]">{m(v.totals.netCents)}</span>
      </div>
      <div className="flex gap-3">
        {v.pdfPath ? (
          <>
            <a href={`/api/statements/${v.statementId}/pdf`} className={buttonClass({ variant: 'secondary', size: 'md' }) + ' flex-1'}><FileText size={18} strokeWidth={2} aria-hidden />{t('downloadPdf')}</a>
            <a href={`/api/statements/${v.statementId}/csv`} className={buttonClass({ variant: 'secondary', size: 'md' }) + ' flex-1'}><Download size={18} strokeWidth={2} aria-hidden />{t('downloadCsv')}</a>
          </>
        ) : <Notice tone="info" title={t('generating')} />}
      </div>
      <Card className="flex flex-col gap-1">
        <h2 className="text-xs font-bold tracking-[0.1em] text-fg-2 uppercase">{t('summary')}</h2>
        <dl>
          {rows.map(([k, val, strong]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line py-2.5 text-sm last:border-0">
              <dt className={strong ? 'font-bold' : 'text-fg-3'}>{k}</dt>
              <dd className={`tabular ${strong ? 'font-bold' : ''}`}>{m(val)}</dd>
            </div>
          ))}
          {v.totals.adjustmentsCents !== 0 && <div className="flex justify-between gap-3 py-2.5 text-sm"><dt className="text-fg-3">{t('adjustments')}</dt><dd className="tabular">{m(v.totals.adjustmentsCents)}</dd></div>}
          {v.totals.heldCents !== 0 && <div className="flex justify-between gap-3 py-2.5 text-sm"><dt className="text-danger-fg">{t('held')}</dt><dd className="tabular text-danger-fg">{m(v.totals.heldCents)}</dd></div>}
        </dl>
      </Card>
      <Card className="flex flex-col gap-1">
        <h2 className="text-xs font-bold tracking-[0.1em] text-fg-2 uppercase">{t('byWork')}</h2>
        <ul>
          {v.byWork.map((w) => (
            <li key={w.title} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium">{w.title}</span>
                <span className="text-xs text-fg-2">{t('share', { pct: pct(w.shareBps, locale, country) })}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className="tabular font-bold">{m(w.netCents)}</span>
                {w.held && <StatusPill tone="coral">{t('inDispute')}</StatusPill>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {group(t('byType'), v.byIncomeType, (k) => t(`types.${k as 'other'}`))}
      {group(t('bySource'), v.bySource)}
      {group(t('byTerritory'), v.byTerritory, (k) => (k.length === 2 ? new Intl.DisplayNames([locale], { type: 'region' }).of(k) ?? k : k))}
      <p className="text-xs text-fg-2">{t('rounding')}</p>
    </>
  );
}
