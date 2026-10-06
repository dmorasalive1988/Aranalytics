import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, ScreenTitle, buttonClass } from '@pluma/ui';
import { ChevronRight } from 'lucide-react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { planName } from '@/lib/format';
import { requireMember } from '@/lib/server';
import { signOutAction } from '@/app/(public)/actions';

export async function generateMetadata() {
  return { title: (await getTranslations('account'))('title') };
}

/** A45 · Cuenta: perfil, idioma, plan y privacidad. */
export default async function Account() {
  const s = await requireMember();
  const t = await getTranslations();
  const locale = await getLocale();
  const p = s.profile!;
  const regions = new Intl.DisplayNames([locale], { type: 'region' });
  return (
    <>
      <ScreenTitle title={t('account.title')} />
      <Card className="flex flex-col gap-1">
        <h2 className="text-xs font-bold tracking-[0.1em] text-fg-2 uppercase">{t('account.profile')}</h2>
        <p className="font-display text-xl font-extrabold">{p.artistName || p.legalName}</p>
        <p className="text-sm text-fg-3">{p.legalName} · {s.email}</p>
        <p className="text-sm text-fg-3">{[p.city, regions.of(p.country), p.societyCode ?? p.societyOther, p.ipi && `IPI ${p.ipi}`].filter(Boolean).join(' · ')}</p>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="text-[15px] font-bold">{t('account.language')}</h2>
        <p className="text-sm text-fg-2">{t('account.languageHint')}</p>
        <LocaleSwitcher current={locale} label={t('account.language')} names={{ es: t('common.languages.es'), en: t('common.languages.en'), 'pt-BR': t('common.languages.pt-BR') }} />
      </Card>
      <Link href="/cuenta/plan" className="flex min-h-16 items-center justify-between rounded-[20px] bg-surface px-5 text-fg no-underline">
        <span className="flex flex-col">
          <span className="text-[15px] font-bold">{t('account.plan')}</span>
          <span className="text-sm text-fg-2">{planName(s.membership!.plan, locale)}</span>
        </span>
        <ChevronRight size={20} strokeWidth={2} aria-hidden />
      </Link>
      <Link href="/cuenta/notificaciones" className="flex min-h-16 items-center justify-between rounded-[20px] bg-surface px-5 text-fg no-underline">
        <span className="flex flex-col">
          <span className="text-[15px] font-bold">{t('common.notifications')}</span>
          <span className="text-sm text-fg-2">{t('prefs.summary')}</span>
        </span>
        <ChevronRight size={20} strokeWidth={2} aria-hidden />
      </Link>
      <Card className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">{t('account.privacy')}</h2>
        <p className="text-sm text-fg-3">{t('account.privacyBody')}</p>
        <a href="mailto:privacidad@pluma.mu" className="text-sm font-bold">{t('account.privacyCta')}</a>
      </Card>
      <form action={signOutAction}>
        <button className={buttonClass({ variant: 'secondary', block: true })}>{t('common.signOut')}</button>
      </form>
    </>
  );
}
