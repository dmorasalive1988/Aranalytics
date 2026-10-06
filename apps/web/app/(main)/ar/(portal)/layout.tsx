import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PlumaLogo } from '@pluma/ui';
import { requirePortalRole } from '@/lib/server';
import { signOutAction } from '@/app/(main)/(public)/actions';

/** Portal A&R: solo invitados (o personal de Pluma). Escritorio y móvil. */
export default async function ArLayout({ children }: { children: React.ReactNode }) {
  await requirePortalRole('ar_guest', '/ar/catalogo');
  const t = await getTranslations('ar');
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <Link href="/ar/catalogo" className="no-underline"><PlumaLogo size={24} product="ar" /></Link>
        <nav aria-label={t('brand')} className="flex items-center gap-4 text-sm font-bold">
          <Link href="/ar/catalogo">{t('catalog')}</Link>
          <Link href="/ar/actividad">{t('activity')}</Link>
          <form action={signOutAction}><button className="min-h-11 text-fg-2">{t('signOut')}</button></form>
        </nav>
      </header>
      <main className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-5 py-8">{children}</main>
    </div>
  );
}
