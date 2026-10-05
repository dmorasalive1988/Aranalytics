import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PlumaAppIcon, ScreenTitle, buttonClass } from '@pluma/ui';
import { requireUser } from '@/lib/server';

/** A10 · ¡Listo! (o "confirmando el pago" mientras llega el webhook). */
export default async function Done() {
  const s = await requireUser();
  const t = await getTranslations('onboarding.done');
  if (s.step !== 'done') {
    return (
      <>
        <meta httpEquiv="refresh" content="3" />
        <ScreenTitle title={t('processing')} />
      </>
    );
  }
  return (
    <div className="flex flex-1 flex-col justify-center gap-8">
      <PlumaAppIcon size={88} />
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <div className="flex flex-col gap-3">
        <Link href="/obras/nueva" className={buttonClass({ block: true })}>{t('cta')}</Link>
        <Link href="/inicio" className={buttonClass({ variant: 'secondary', block: true })}>{t('later')}</Link>
      </div>
    </div>
  );
}
