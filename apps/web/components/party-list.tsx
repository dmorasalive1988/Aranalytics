import { getLocale, getTranslations } from 'next-intl/server';
import type { WorkDetail } from '@pluma/services';
import { cn } from '@pluma/ui';
import { pct } from '@/lib/format';

type Party = WorkDetail['versions'][number]['parties'][number];

/** Reparto con estado de firma de cada parte. */
export async function PartyList({ parties, showStatus = true }: { parties: Party[]; showStatus?: boolean }) {
  const t = await getTranslations();
  const locale = await getLocale();
  return (
    <ul className="flex flex-col">
      {[...parties].sort((a, b) => Number(b.isMe) - Number(a.isMe) || b.bps - a.bps).map((p) => (
        <li key={p.shareId} className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[15px] font-medium">{p.isMe ? t('common.you') : p.displayName}</span>
            <span className="truncate text-xs text-fg-2">
              {t(`splits.roles.${p.role}`)} · {p.administered ? t('splits.administered') : t('splits.informative')}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="tabular text-[15px] font-bold">{pct(p.bps, locale)}</span>
            {showStatus && (
              <span className={cn('text-xs font-bold', p.status === 'signed' ? 'text-ok-fg' : 'text-danger-fg')}>
                {p.status === 'signed' ? t('workDetail.signed') : p.status === 'rejected' ? t('workDetail.rejected') : t('workDetail.pending')}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
