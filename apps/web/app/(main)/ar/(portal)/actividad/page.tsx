import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, ScreenTitle, StatusPill } from '@pluma/ui';
import { catalog } from '@pluma/services';
import { date } from '@/lib/format';
import { deps, requirePortalRole } from '@/lib/server';

/** C4 · Mis intereses y holds. */
export default async function ArActivity() {
  const s = await requirePortalRole('ar_guest', '/ar/actividad');
  const t = await getTranslations('ar');
  const tc = await getTranslations('catalog');
  const locale = await getLocale();
  const a = await catalog.arActivity(deps(), s.userId);
  return (
    <>
      <ScreenTitle title={t('activity')} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <h2 className="font-bold">{t('holds')}</h2>
          {a.holds.length === 0 ? <p className="text-sm text-fg-2">{t('activityEmpty')}</p> : a.holds.map((h) => (
            <Link key={h.id} href={`/ar/obra/${h.work_id}`} className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 text-fg no-underline last:border-0">
              <span className="flex flex-col"><span className="text-[15px]">{h.title}</span><span className="text-xs text-fg-2">{t('days', { n: h.duration_days })}{h.ends_at && h.status === 'active' ? ` · ${t('heldUntil', { date: date(h.ends_at, locale) })}` : ''}</span></span>
              <StatusPill tone={h.status === 'active' ? 'verde' : h.status === 'requested' ? 'ambar' : 'niebla'}>{tc(`holdStatus.${h.status}`)}</StatusPill>
            </Link>
          ))}
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-bold">{t('interests')}</h2>
          {a.interests.length === 0 ? <p className="text-sm text-fg-2">{t('activityEmpty')}</p> : a.interests.map((i) => (
            <Link key={i.work_id} href={`/ar/obra/${i.work_id}`} className="flex min-h-12 items-center justify-between border-b border-line py-2 text-fg no-underline last:border-0">
              <span className="text-[15px]">{i.title}</span><span className="text-xs text-fg-2">{date(i.created_at, locale)}</span>
            </Link>
          ))}
        </Card>
      </div>
    </>
  );
}
