import { desc, t } from '@pluma/db';
import { Card } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle, Table } from '@/components/table';
import { fmtDate } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';
import { exportAction } from '../actions';

export const metadata = { title: 'Exportar para registro' };

/** E13 · Exporta las obras con splits firmados en el formato de alta y las marca como enviadas. */
export default async function Export() {
  await requireStaff();
  const subs = await deps().db.select().from(t.publisherSubmissions).orderBy(desc(t.publisherSubmissions.createdAt)).limit(50);
  return (
    <>
      <PageTitle title="Exportar para registro">Genera el archivo de alta con todas las obras cuyos splits ya firmaron todos.</PageTitle>
      <Card className="max-w-xl"><ActionForm action={exportAction} submitLabel="Generar exportación" pendingLabel="Generando…" /></Card>
      <Table head={['Fecha', 'Obras', 'Archivo', 'SHA-256', '']}>
        {subs.map((s) => (
          <tr key={s.id}>
            <td className="tabular whitespace-nowrap">{fmtDate(s.createdAt)}</td>
            <td className="tabular">{s.workIds.length}</td>
            <td className="text-xs">{s.filePath.split('/').pop()}</td>
            <td className="tabular text-xs">{s.sha256.slice(0, 16)}…</td>
            <td><a href={`/api/export/${s.id}`} className="font-bold">Descargar CSV</a></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
