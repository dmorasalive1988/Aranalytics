import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Clapperboard } from 'lucide-react';
import { buttonClass } from '@pluma/ui';
import { ComingSoon } from '@/components/coming-soon';
import { requireMember } from '@/lib/server';

export async function generateMetadata() {
  return { title: (await getTranslations('nav'))('sync') };
}

/** Sync (fase e). Los opt-ins por obra ya funcionan desde el detalle de cada obra. */
export default async function Sync() {
  const s = await requireMember();
  const t = await getTranslations('workDetail');
  return (
    <ComingSoon section="sync" icon={<Clapperboard size={28} strokeWidth={2} aria-hidden />}>
      {s.membership?.plan !== 'pro' && <Link href="/cuenta/plan" className={buttonClass({ variant: 'outline-ambar', size: 'md' })}>{t('upgrade')}</Link>}
    </ComingSoon>
  );
}
