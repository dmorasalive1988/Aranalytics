import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { CircleUserRound } from 'lucide-react';
import { notifications } from '@pluma/services';
import { PlumaLogo, StatusPill } from '@pluma/ui';
import { BottomNav } from '@/components/bottom-nav';
import { InstallApp } from '@/components/install-app';
import { NotificationBell } from '@/components/notification-bell';
import { SideNav } from '@/components/side-nav';
import { planName } from '@/lib/format';
import { hasAnalytics } from '@/lib/plan-features';
import { deps, requireMember } from '@/lib/server';

/**
 * App del autor (solo socios con plan activo).
 * Celular: cabecera + contenido en una columna + navegación inferior.
 * Escritorio (≥ 1024 px): barra lateral fija y contenido ancho; las pantallas con [data-wide] usan hasta 1280 px.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireMember();
  const t = await getTranslations();
  const locale = await getLocale();
  const unread = await notifications.unreadCount(deps(), s.userId);
  const install = t.raw('install') as Parameters<typeof InstallApp>[0]['labels'];
  const nav = { home: t('nav.home'), works: t('nav.works'), network: t('nav.network'), sync: t('nav.sync'), payments: t('nav.payments'), analytics: t('nav.analytics'), main: t('nav.main') };
  const name = s.profile?.artistName || s.profile?.legalName || '';
  return (
    <div className="min-h-dvh pb-28 lg:flex lg:pb-0">
      <SideNav
        labels={nav}
        analytics={hasAnalytics(s.membership!)}
        footer={
          <>
            <InstallApp labels={install} />
            <Link href="/cuenta" className="flex min-h-11 items-center gap-3 rounded-xl text-fg no-underline hover:text-ambar">
              <CircleUserRound size={22} strokeWidth={2} aria-hidden />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold">{name || t('common.account')}</span>
                <span className="text-xs text-fg-2">{t('home.planPill', { plan: planName(s.membership!.plan, locale) })}</span>
              </span>
            </Link>
          </>
        }
      />
      <div className="min-w-0 flex-1">
        <header className="mx-auto flex w-full max-w-[560px] items-center justify-between px-5 pt-5 lg:max-w-none lg:justify-end lg:px-10 lg:pt-6">
          <Link href="/inicio" aria-label="Pluma" className="no-underline lg:hidden">
            <PlumaLogo size={22} />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden lg:inline-flex">
              <StatusPill tone={s.membership!.plan === 'pro' ? 'ambar' : 'niebla'}>{t('home.planPill', { plan: planName(s.membership!.plan, locale) })}</StatusPill>
            </span>
            <NotificationBell count={unread} labels={{ none: t('common.notifications'), some: t('inbox.bellUnread', { count: '{count}' }) }} />
            <Link href="/cuenta" aria-label={t('common.account')} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-fg">
              <CircleUserRound size={22} strokeWidth={2} aria-hidden />
            </Link>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-5 pt-6 lg:max-w-[760px] lg:px-10 lg:pb-16 lg:has-[[data-wide]]:max-w-[1280px]">{children}</main>
      </div>
      <BottomNav labels={{ home: nav.home, works: nav.works, network: nav.network, sync: nav.sync, payments: nav.payments, main: nav.main }} />
    </div>
  );
}
