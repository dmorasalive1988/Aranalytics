import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { isDemoMode } from '@pluma/db/env';

/** Franja visible en toda la demo: datos ficticios y acceso al buzón de correos. */
export async function DemoBanner() {
  if (!isDemoMode()) return null;
  const t = await getTranslations('demo');
  return (
    <div role="note" className="flex min-h-9 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 bg-ambar px-4 py-1.5 text-center text-xs font-bold text-tinta">
      <span>{t('banner')}</span>
      <Link href="/demo/correo" className="text-tinta underline">{t('inboxLink')}</Link>
    </div>
  );
}
