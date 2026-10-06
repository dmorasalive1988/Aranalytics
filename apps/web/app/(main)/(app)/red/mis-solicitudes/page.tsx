import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ScreenTitle, StatusPill } from '@pluma/ui';
import { network } from '@pluma/services';
import { NetworkTabs } from '@/components/network-tabs';
import { networkGate } from '@/components/network-gate';
import { date } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';

export async function generateMetadata() {
  return { title: (await getTranslations('network'))('myRequests') };
}

/** A38 · Mis solicitudes, con las postulaciones por responder. */
export default async function MyRequests() {
  const s = await requireMember();
  const t = await getTranslations('network');
  const locale = await getLocale();
  const gate = await networkGate(s.userId);
  const rows = await network.myRequests(deps(), s.userId);
  return (
    <>
      <ScreenTitle title={t('myRequests')} />
      <NetworkTabs current="mine" />
      {gate.notice}
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-2">{t('mineEmpty')}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/red/${r.id}`} className="flex min-h-16 items-center justify-between gap-3 border-b border-line py-3 text-fg no-underline">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-[15px] font-medium">{r.title}</span>
                  <span className="truncate text-xs text-fg-2">{[t(`types.${r.type}`), t('applicationsCount', { count: r.total }), r.status === 'open' ? t('expiresShort', { date: date(r.expires_at, locale) }) : null].filter(Boolean).join(' · ')}</span>
                </span>
                {r.hidden ? <StatusPill tone="coral">{t('status.hidden')}</StatusPill> : r.pending > 0 ? <StatusPill tone="coral">{t('pendingCount', { count: r.pending })}</StatusPill> : <StatusPill tone={r.status === 'open' ? 'verde' : 'niebla'}>{t(`status.${r.status}`)}</StatusPill>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
