import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { chipClass } from '@pluma/ui';

export async function SyncTabs({ current, counts }: { current: 'licenses' | 'holds' | 'briefs'; counts?: { licenses?: number; holds?: number } }) {
  const t = await getTranslations('syncHub');
  const tabs = [
    ['licenses', '/sync/licencias', t('licenses'), counts?.licenses],
    ['holds', '/sync/holds', t('holds'), counts?.holds],
    ['briefs', '/sync/briefs', t('briefs'), undefined],
  ] as const;
  return (
    <nav aria-label={t('title')} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {tabs.map(([k, href, label, n]) => (
        <Link key={k} href={href} aria-current={current === k ? 'page' : undefined} className={`${chipClass(current === k)} no-underline`}>
          {label}
          {n ? <span className="tabular rounded-full bg-coral px-1.5 text-[11px] text-tinta">{n}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
