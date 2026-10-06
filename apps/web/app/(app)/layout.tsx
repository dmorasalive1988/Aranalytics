import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Bell, CircleUserRound } from 'lucide-react';
import { notifications } from '@pluma/services';
import { PlumaLogo } from '@pluma/ui';
import { BottomNav } from '@/components/bottom-nav';
import { deps, requireMember } from '@/lib/server';

/** App del autor (solo socios con plan activo): cabecera + contenido + navegación inferior. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireMember();
  const t = await getTranslations();
  const unread = await notifications.unreadCount(deps(), s.userId);
  return (
    <div className="min-h-dvh pb-28">
      <header className="mx-auto flex w-full max-w-[560px] items-center justify-between px-5 pt-5">
        <Link href="/inicio" aria-label="Pluma" className="no-underline">
          <PlumaLogo size={22} />
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/notificaciones" aria-label={unread ? t('inbox.bellUnread', { count: unread }) : t('common.notifications')} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-fg">
            <Bell size={22} strokeWidth={2} aria-hidden />
            {unread > 0 && (
              <span aria-hidden className="tabular absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] font-bold text-tinta">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
          <Link href="/cuenta" aria-label={t('common.account')} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-fg">
            <CircleUserRound size={22} strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-5 pt-6">{children}</main>
      <BottomNav labels={{ home: t('nav.home'), works: t('nav.works'), network: t('nav.network'), sync: t('nav.sync'), payments: t('nav.payments'), main: t('nav.main') }} />
    </div>
  );
}
