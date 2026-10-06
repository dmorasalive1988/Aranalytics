import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PlumaLogo } from '@pluma/ui';
import { requirePortalRole } from '@/lib/server';
import { signOutAction } from '@/app/(main)/(public)/actions';

/** Pluma Sync (escritorio): compradores registrados. */
export default async function SyncPortalLayout({ children }: { children: React.ReactNode }) {
  await requirePortalRole('sync_buyer', '/pluma-sync/buscar');
  const t = await getTranslations('plumaSync');
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <Link href="/pluma-sync/buscar" className="no-underline"><PlumaLogo size={24} product="sync" /></Link>
        <nav aria-label={t('brand')} className="flex items-center gap-4 text-sm font-bold">
          <Link href="/pluma-sync/buscar">{t('search')}</Link>
          <Link href="/pluma-sync/solicitudes">{t('requests')}</Link>
          <Link href="/pluma-sync/briefs">{t('briefs')}</Link>
          <form action={signOutAction}><button className="min-h-11 text-fg-2">{t('signOut')}</button></form>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 py-8">{children}</main>
    </div>
  );
}
