import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ScreenTitle, StatusPill } from '@pluma/ui';
import { network } from '@pluma/services';
import { NetworkTabs } from '@/components/network-tabs';
import { date } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';

export async function generateMetadata() {
  return { title: (await getTranslations('network'))('myApplications') };
}

const TONE = { pending: 'ambar', accepted: 'verde', declined: 'niebla', expired: 'niebla', withdrawn: 'niebla' } as const;

/** A39 · Mis postulaciones: estado y vencimiento; las aceptadas llevan a la colaboración. */
export default async function MyApplications() {
  const s = await requireMember();
  const t = await getTranslations('network');
  const locale = await getLocale();
  const rows = await network.myApplications(deps(), s.userId);
  return (
    <>
      <ScreenTitle title={t('myApplications')} />
      <NetworkTabs current="applications" />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-2">{t('appsEmpty')}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((a) => (
            <li key={a.id}>
              <Link href={a.collaboration_id ? `/red/colaboraciones/${a.collaboration_id}` : `/red/${a.request_id}`} className="flex min-h-16 items-center justify-between gap-3 border-b border-line py-3 text-fg no-underline">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-[15px] font-medium">{a.title}</span>
                  <span className="truncate text-xs text-fg-2">{[a.author_name, a.status === 'pending' ? t('expiresShort', { date: date(a.expires_at, locale) }) : null].filter(Boolean).join(' · ')}</span>
                </span>
                <StatusPill tone={TONE[a.status as keyof typeof TONE] ?? 'niebla'}>{t(`status.${a.status}`)}</StatusPill>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
