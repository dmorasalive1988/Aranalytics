import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { WORK_STATUS_TONE, type WorkStatus } from '@pluma/domain';
import { StatusPill } from '@pluma/ui';
import { AlertTriangle } from 'lucide-react';
import type { WorkListItem } from '@pluma/services';
import { pct } from '@/lib/format';

export async function StatusBadge({ status }: { status: WorkStatus }) {
  const t = await getTranslations('works.status');
  return <StatusPill tone={WORK_STATUS_TONE[status]} icon={status === 'disputed' ? <AlertTriangle size={12} strokeWidth={2.5} aria-hidden /> : undefined}>{t(status)}</StatusPill>;
}

/** Fila de obra: título, tu parte, autores y píldora de estado. */
export async function WorkRow({ w }: { w: WorkListItem }) {
  const t = await getTranslations('works');
  const locale = await getLocale();
  const meta = [w.myBps !== null ? t('myShare', { pct: pct(w.myBps, locale) }) : null, t('authors', { count: w.authors }), w.pendingSignatures > 0 && w.status === 'awaiting_signatures' ? t('pending', { count: w.pendingSignatures }) : null].filter(Boolean).join(' · ');
  return (
    <li>
      <Link href={`/obras/${w.id}`} className="flex min-h-16 items-center justify-between gap-3 border-b border-line py-3 text-fg no-underline">
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-[15px] font-medium">{w.title}</span>
          <span className="truncate text-xs text-fg-2">{meta}</span>
        </span>
        <StatusBadge status={w.status} />
      </Link>
    </li>
  );
}
