import Link from 'next/link';
import { WORK_STATUSES, type WorkStatus } from '@pluma/domain';
import { MESSAGES } from '@pluma/i18n';
import { admin } from '@pluma/services';
import { chipClass } from '@pluma/ui';
import { PageTitle, Table } from '@/components/table';
import { WorkStatusPill, fmtDate } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';

export const metadata = { title: 'Obras' };

/** E12 · Obras con filtro por estado y búsqueda por título, código de obra o ISWC. */
export default async function Works({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const s = await requireStaff();
  const { status, q = '' } = await searchParams;
  const st = WORK_STATUSES.includes(status as WorkStatus) ? (status as WorkStatus) : undefined;
  const rows = await admin.listWorksAdmin(deps(), s.id, { status: st, q: q || undefined });
  return (
    <>
      <PageTitle title="Obras" />
      <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        <Link href="/obras" className={chipClass(!st)}>Todas</Link>
        {WORK_STATUSES.map((x) => <Link key={x} href={`/obras?status=${x}`} className={chipClass(st === x)}>{MESSAGES.es.works.status[x]}</Link>)}
      </nav>
      <Table head={['Obra', 'Autor', 'Estado', 'Código de obra', 'ISWC', 'Actualizada']}>
        {rows.map((w) => (
          <tr key={w.id}>
            <td><Link href={`/obras/${w.id}`} className="font-bold">{w.title}</Link></td>
            <td><Link href={`/autores/${w.ownerId}`}>{w.owner}</Link></td>
            <td><WorkStatusPill status={w.status} /></td>
            <td className="tabular">{w.publisherWorkCode ?? '—'}</td>
            <td className="tabular">{w.iswc ?? '—'}</td>
            <td className="tabular whitespace-nowrap">{fmtDate(w.updatedAt)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
