import { getTranslations } from 'next-intl/server';
import { Notice, PlumaLogo } from '@pluma/ui';
import { signOutAction } from '@/app/(main)/(public)/actions';

export default async function NoAccess() {
  const t = await getTranslations('ar');
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 px-5 py-10">
      <PlumaLogo size={26} product="ar" />
      <Notice tone="alert" title={t('noAccess')} />
      <form action={signOutAction}><button className="min-h-11 font-bold text-accent-fg">{t('signOut')}</button></form>
    </main>
  );
}
