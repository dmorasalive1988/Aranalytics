import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, Field, Input, ScreenTitle, StatusPill } from '@pluma/ui';
import { catalog } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { SyncTabs } from '@/components/sync-tabs';
import { date } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';
import { decideHoldAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getTranslations('syncHub'))('holds') };
}

const TONE: Record<string, 'ambar' | 'verde' | 'coral' | 'niebla'> = { requested: 'ambar', active: 'verde', approved: 'verde', rejected: 'niebla', expired: 'niebla', released: 'niebla' };

/** A32 · Solicitudes de hold: aprobar o rechazar 30/60/90 días. */
export default async function Holds() {
  const s = await requireMember();
  const t = await getTranslations('syncHub');
  const tc = await getTranslations('catalog');
  const locale = await getLocale();
  const [rows, lic] = await Promise.all([catalog.holdsForOwner(deps(), s.userId), catalog.licensesForWriter(deps(), s.userId)]);
  return (
    <>
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <SyncTabs current="holds" counts={{ licenses: lic.filter((r) => r.status === 'awaiting_writers' && !r.my_decision).length, holds: rows.filter((h) => h.status === 'requested').length }} />
      {rows.length === 0 && <p className="py-6 text-center text-sm text-fg-2">{t('holdsEmpty')}</p>}
      {rows.map((h) => (
        <Card key={h.id} className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Link href={`/obras/${h.work_id}`} className="font-display text-lg font-extrabold text-fg no-underline">{h.title}</Link>
              <span className="text-sm text-fg-2">{t('from', { company: h.company ?? 'A&R' })} · {t('holdFor', { days: h.duration_days })}</span>
            </div>
            <StatusPill tone={TONE[h.status] ?? 'niebla'}>{tc(`holdStatus.${h.status}`)}</StatusPill>
          </div>
          {h.message && <blockquote className="border-l-2 border-ambar pl-3 text-[15px] italic">{h.message}</blockquote>}
          {h.status === 'active' && h.ends_at && <p className="text-sm text-fg-2">{t('heldUntil', { date: date(h.ends_at, locale) })}</p>}
          {h.status === 'requested' && (
            <div className="flex flex-col gap-2">
              <ActionForm action={decideHoldAction.bind(null, h.id, true)} submitLabel={t('approve')} className="flex flex-col" />
              <details className="rounded-xl border border-stroke px-4 py-2">
                <summary className="min-h-10 cursor-pointer content-center text-sm font-bold">{t('reject')}</summary>
                <ActionForm action={decideHoldAction.bind(null, h.id, false)} submitLabel={t('reject')} submitVariant="secondary">
                  <Field id={`r-${h.id}`} label={t('reason')}><Input id={`r-${h.id}`} name="reason" /></Field>
                </ActionForm>
              </details>
            </div>
          )}
        </Card>
      ))}
    </>
  );
}
