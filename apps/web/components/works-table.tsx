import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import type { WorkListItem } from '@pluma/services';
import { date, pct } from '@/lib/format';
import { StatusBadge } from './work-row';

/** Tabla de obras para escritorio: título, tu parte, autores, firmas pendientes, catálogos, fecha y estado. */
export async function WorksTable({ works, showUpdated = false }: { works: WorkListItem[]; showUpdated?: boolean }) {
  const t = await getTranslations('home');
  const tw = await getTranslations('works');
  const locale = await getLocale();
  return (
    <div className="overflow-hidden rounded-[20px] bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-fg-2">
          <tr className="border-b border-line">
            <th scope="col" className="px-5 py-3 font-medium">{t('colTitle')}</th>
            <th scope="col" className="px-5 py-3 font-medium">{t('colShare')}</th>
            <th scope="col" className="px-5 py-3 font-medium">{t('colAuthors')}</th>
            <th scope="col" className="px-5 py-3 font-medium">{tw('colCatalogs')}</th>
            {showUpdated && <th scope="col" className="px-5 py-3 font-medium">{tw('colUpdated')}</th>}
            <th scope="col" className="px-5 py-3 font-medium">{t('colStatus')}</th>
          </tr>
        </thead>
        <tbody>
          {works.map((w) => (
            <tr key={w.id} className="border-b border-line last:border-0 hover:bg-surface-2">
              <td className="px-5 py-3.5"><Link href={`/obras/${w.id}`} className="font-medium text-fg no-underline hover:text-ambar">{w.title}</Link></td>
              <td className="tabular px-5 py-3.5 text-fg-3">{w.myBps !== null ? pct(w.myBps, locale) : '—'}</td>
              <td className="tabular px-5 py-3.5 text-fg-3">
                {w.authors}
                {w.pendingSignatures > 0 && w.status === 'awaiting_signatures' && <span className="ml-2 text-xs text-danger-fg">{tw('pending', { count: w.pendingSignatures })}</span>}
              </td>
              <td className="px-5 py-3.5 text-fg-3">{w.syncOptIn ? tw('syncOn') : '—'}</td>
              {showUpdated && <td className="tabular px-5 py-3.5 text-fg-3">{date(w.updatedAt, locale)}</td>}
              <td className="px-5 py-3.5"><StatusBadge status={w.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
