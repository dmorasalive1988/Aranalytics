import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { ScreenTitle, StatusPill } from '@pluma/ui';
import { network } from '@pluma/services';
import { NetworkTabs } from '@/components/network-tabs';
import { date } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';

export async function generateMetadata() {
  return { title: (await getTranslations('network'))('collaborations') };
}

export default async function Collaborations() {
  const s = await requireMember();
  const t = await getTranslations('network');
  const locale = await getLocale();
  const rows = await network.myCollaborations(deps(), s.userId);
  return (
    <>
      <ScreenTitle title={t('collaborations')} />
      <NetworkTabs current="collabs" />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-fg-2">{t('collabsEmpty')}</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/red/colaboraciones/${c.id}`} className="flex min-h-16 items-center justify-between gap-3 border-b border-line py-3 text-fg no-underline">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-[15px] font-medium">{c.title}</span>
                  <span className="text-xs text-fg-2">{date(c.created_at, locale)}</span>
                </span>
                <StatusPill tone={c.work_id ? 'verde' : 'ambar'}>{c.work_id ? t('closedShort') : t('inProgress')}</StatusPill>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
