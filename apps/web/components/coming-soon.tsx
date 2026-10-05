import { getTranslations } from 'next-intl/server';
import { Card, ScreenTitle, StatusPill } from '@pluma/ui';
import type { ReactNode } from 'react';

/** Pantallas de navegación cuya funcionalidad llega en fases posteriores (b, d, e). */
export async function ComingSoon({ section, icon, children }: { section: 'network' | 'sync' | 'payments'; icon: ReactNode; children?: ReactNode }) {
  const t = await getTranslations();
  return (
    <>
      <ScreenTitle title={t(`soon.${section}.title`)} />
      <Card className="flex flex-col items-start gap-4">
        <span className="text-accent-fg">{icon}</span>
        <StatusPill tone="niebla">{t('common.comingSoon')}</StatusPill>
        <p className="text-[15px] leading-relaxed text-fg-3">{t(`soon.${section}.body`)}</p>
        {children}
      </Card>
    </>
  );
}
