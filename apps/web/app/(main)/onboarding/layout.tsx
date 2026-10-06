import { getTranslations } from 'next-intl/server';
import { PlumaLogo } from '@pluma/ui';
import { signOutAction } from '@/app/(main)/(public)/actions';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('common');
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 px-5 pb-10 pt-6">
      <div className="flex items-center justify-between">
        <PlumaLogo size={22} />
        <form action={signOutAction}>
          <button className="min-h-11 px-2 text-sm text-fg-2 hover:text-fg">{t('signOut')}</button>
        </form>
      </div>
      {children}
    </main>
  );
}
