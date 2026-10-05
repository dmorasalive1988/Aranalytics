import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ScreenTitle, buttonClass } from '@pluma/ui';
import { Plus } from 'lucide-react';
import { listMyWorks } from '@pluma/services';
import { WorkRow } from '@/components/work-row';
import { deps, requireMember } from '@/lib/server';

export async function generateMetadata() {
  return { title: (await getTranslations('works'))('title') };
}

/** A21 · Obras. */
export default async function Works() {
  const s = await requireMember();
  const t = await getTranslations('works');
  const works = await listMyWorks(deps(), s.userId);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <ScreenTitle title={t('title')} />
        <Link href="/obras/nueva" className={buttonClass({ size: 'md' })}>
          <Plus size={18} strokeWidth={2} aria-hidden />
          {t('new')}
        </Link>
      </div>
      {works.length === 0 ? <p className="text-[15px] leading-relaxed text-fg-2">{t('empty')}</p> : <ul>{works.map((w) => <WorkRow key={w.id} w={w} />)}</ul>}
    </>
  );
}
