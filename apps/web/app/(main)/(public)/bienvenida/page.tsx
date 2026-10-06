import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { PlumaSymbol, buttonClass } from '@pluma/ui';
import { LocaleSwitcher } from '@/components/locale-switcher';

export async function generateMetadata() {
  const t = await getTranslations('common');
  return { title: t('concept') };
}

/** A1 · Bienvenida con selector de idioma. */
export default async function Welcome() {
  const t = await getTranslations();
  const locale = await getLocale();
  return (
    <div className="flex flex-1 flex-col justify-between gap-10">
      <div className="flex justify-end">
        <LocaleSwitcher current={locale} label={t('welcome.chooseLanguage')} names={{ es: t('common.languages.es'), en: t('common.languages.en'), 'pt-BR': t('common.languages.pt-BR') }} />
      </div>
      <div className="flex flex-col gap-6">
        <PlumaSymbol size={112} title="Pluma" />
        <p className="font-display text-[56px] leading-none font-extrabold tracking-[-0.04em]" aria-hidden>
          pluma
        </p>
        <h1 className="font-display text-[34px] leading-[1.1] font-semibold tracking-[-0.02em]">{t('welcome.headline')}</h1>
        <p className="text-[17px] leading-relaxed text-fg-3">{t('welcome.sub')}</p>
        <p className="font-display text-xl font-semibold text-ambar">{t('common.tagline')}</p>
      </div>
      <div className="flex flex-col gap-3">
        <Link href="/registro" className={buttonClass({ block: true })}>
          {t('welcome.create')}
        </Link>
        <Link href="/entrar" className={buttonClass({ variant: 'secondary', block: true })}>
          {t('welcome.login')}
        </Link>
      </div>
    </div>
  );
}
