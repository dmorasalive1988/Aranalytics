import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, Notice, ScreenTitle, StatusPill } from '@pluma/ui';
import { CircleCheck } from 'lucide-react';
import { catalog } from '@pluma/services';
import { date } from '@/lib/format';
import { deps, requirePortalRole } from '@/lib/server';

const TONE: Record<string, 'ambar' | 'verde' | 'coral' | 'niebla'> = { awaiting_writers: 'ambar', writers_approved: 'verde', negotiating: 'ambar', issued: 'verde', writers_rejected: 'coral', canceled: 'niebla', submitted: 'ambar' };

/** D7 · Mis solicitudes de licencia. */
export default async function BuyerRequests({ searchParams }: { searchParams: Promise<{ enviada?: string }> }) {
  const s = await requirePortalRole('sync_buyer', '/pluma-sync/solicitudes');
  const { enviada } = await searchParams;
  const t = await getTranslations('plumaSync');
  const tc = await getTranslations('catalog');
  const locale = await getLocale();
  const rows = await catalog.buyerRequests(deps(), s.userId);
  const fmt = (c: string | number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'code', maximumFractionDigits: 0 }).format(Number(c) / 100);
  return (
    <>
      <ScreenTitle title={t('requestsTitle')} />
      {enviada && <Notice tone="ok" icon={<CircleCheck size={20} strokeWidth={2} />} title={t('sent')} />}
      {rows.length === 0 ? <p className="py-8 text-center text-sm text-fg-2">{t('requestsEmpty')}</p> : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/pluma-sync/obra/${r.work_id}`} className="font-display text-lg font-extrabold text-fg no-underline">{r.title}</Link>
                <StatusPill tone={TONE[r.status] ?? 'niebla'}>{tc(`licenseStatus.${r.status}`)}</StatusPill>
              </div>
              <p className="text-sm text-fg-2">{[tc(`usages.${r.usage}`), tc(`territories.${r.territory}`), tc('term', { n: r.term_months }), date(r.created_at, locale)].join(' · ')}</p>
              <p className="tabular text-sm">{t('range')}: {fmt(r.quote_min_cents)} – {fmt(r.quote_max_cents)}</p>
              {r.final_fee_cents && <p className="tabular font-bold text-accent-fg">{t('fee', { fee: fmt(r.final_fee_cents) })}</p>}
              {r.operator_note && <p className="text-sm text-fg-3">{r.operator_note}</p>}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
