import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, ScreenTitle, StatusPill } from '@pluma/ui';
import { catalog } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { SyncTabs } from '@/components/sync-tabs';
import { date, money } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';
import { decideLicenseAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getTranslations('syncHub'))('licenses') };
}

const TONE: Record<string, 'ambar' | 'verde' | 'coral' | 'niebla'> = { awaiting_writers: 'ambar', writers_approved: 'verde', negotiating: 'ambar', issued: 'verde', writers_rejected: 'coral', canceled: 'niebla', submitted: 'ambar' };

/** A33 · Solicitudes de licencia: uso, territorio, plazo, cotización; aprobar o rechazar. */
export default async function Licenses() {
  const s = await requireMember();
  const t = await getTranslations('syncHub');
  const tc = await getTranslations('catalog');
  const tp = await getTranslations('plumaSync');
  const locale = await getLocale();
  const [rows, holds] = await Promise.all([catalog.licensesForWriter(deps(), s.userId), catalog.holdsForOwner(deps(), s.userId)]);
  const pending = rows.filter((r) => r.status === 'awaiting_writers' && !r.my_decision).length;
  const m = (c: string | number) => money(Number(c), locale, s.profile?.country);
  return (
    <>
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <SyncTabs current="licenses" counts={{ licenses: pending, holds: holds.filter((h) => h.status === 'requested').length }} />
      <p className="text-sm text-fg-3">{t('explain')}</p>
      {rows.length === 0 && <p className="py-6 text-center text-sm text-fg-2">{t('licensesEmpty')}</p>}
      {rows.map((r) => (
        <Card key={r.id} className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link href={`/obras/${r.work_id}`} className="font-display text-lg font-extrabold text-fg no-underline">{r.title}</Link>
              <span className="text-sm text-fg-2">{t('from', { company: r.company ?? 'Pluma Sync' })} · {date(r.created_at, locale)}</span>
            </div>
            <StatusPill tone={TONE[r.status] ?? 'niebla'}>{tc(`licenseStatus.${r.status}`)}</StatusPill>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-xs text-fg-3">{tp('usage')}</dt><dd>{tc(`usages.${r.usage}`)}{r.one_stop_requested ? ' · One-stop' : ''}</dd></div>
            <div><dt className="text-xs text-fg-3">{tp('territory')}</dt><dd>{tc(`territories.${r.territory}`)} · {tc('term', { n: r.term_months })}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-fg-3">{t('quote')}</dt><dd className="tabular font-bold text-accent-fg">{m(r.quote_min_cents)} – {m(r.quote_max_cents)}</dd></div>
            {r.final_fee_cents && <div className="col-span-2"><dd className="tabular font-bold">{t('fee', { fee: m(r.final_fee_cents) })}</dd></div>}
          </dl>
          <p className="text-sm"><span className="text-fg-3">{t('project')}: </span>{r.project_description}</p>
          {r.status === 'awaiting_writers' && !r.my_decision && (
            <div className="grid grid-cols-2 gap-2">
              <ActionForm action={decideLicenseAction.bind(null, r.id, true)} submitLabel={t('approve')} className="flex flex-col" />
              <ActionForm action={decideLicenseAction.bind(null, r.id, false)} submitLabel={t('reject')} submitVariant="secondary" className="flex flex-col" />
            </div>
          )}
          {r.my_decision && <p className="text-sm text-fg-2">{r.my_decision === 'approved' ? t('approved') : t('rejected')}{r.status === 'awaiting_writers' ? ` · ${t('awaitingOthers')}` : ''}</p>}
        </Card>
      ))}
    </>
  );
}
