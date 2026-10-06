import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { chipClass } from '@pluma/ui';

/** Subnavegación de la red: tablero, mis solicitudes, postulaciones y colaboraciones. */
export async function NetworkTabs({ current }: { current: 'board' | 'mine' | 'applications' | 'collabs' }) {
  const t = await getTranslations('network');
  const tabs = [
    ['board', '/red', t('boardTab')],
    ['mine', '/red/mis-solicitudes', t('myRequests')],
    ['applications', '/red/postulaciones', t('myApplications')],
    ['collabs', '/red/colaboraciones', t('collaborations')],
  ] as const;
  return (
    <nav aria-label={t('title')} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {tabs.map(([k, href, label]) => (
        <Link key={k} href={href} aria-current={current === k ? 'page' : undefined} className={`${chipClass(current === k)} no-underline`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
