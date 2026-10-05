import { admin } from '@pluma/services';
import { Input, Notice } from '@pluma/ui';
import { PageTitle, Table } from '@/components/table';
import { fmtDate } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';

export const metadata = { title: 'Auditoría' };

/** E19 · Registro inmutable de toda acción sobre dinero, splits, contratos, planes y roles. */
export default async function Audit({ searchParams }: { searchParams: Promise<{ entity?: string; actor?: string; command?: string }> }) {
  const s = await requireStaff();
  const f = await searchParams;
  const { rows, chainBrokenAt } = await admin.auditLog(deps(), s.id, { entityId: f.entity || undefined, actorId: f.actor || undefined, command: f.command || undefined });
  return (
    <>
      <PageTitle title="Auditoría">Solo inserción, encadenada por hash. Nadie puede editar ni borrar filas.</PageTitle>
      {chainBrokenAt ? <Notice tone="alert" title={`Cadena rota en la fila ${chainBrokenAt}.`} /> : <Notice tone="ok" title="Cadena íntegra." />}
      <form className="flex flex-wrap gap-3" role="search">
        <label className="sr-only" htmlFor="entity">Entidad</label><Input id="entity" name="entity" defaultValue={f.entity} placeholder="ID de entidad" className="w-72" />
        <label className="sr-only" htmlFor="actor">Actor</label><Input id="actor" name="actor" defaultValue={f.actor} placeholder="ID de actor" className="w-72" />
        <label className="sr-only" htmlFor="command">Comando</label><Input id="command" name="command" defaultValue={f.command} placeholder="Comando (split., membership.)" className="w-64" />
        <button className="h-12 rounded-xl bg-tinta px-5 font-bold text-papel">Filtrar</button>
      </form>
      <Table head={['#', 'Fecha', 'Actor', 'Comando', 'Acción', 'Entidad', 'Cambio', 'IP']}>
        {rows.map((r) => (
          <tr key={r.id} className="align-top">
            <td className="tabular">{r.id}</td>
            <td className="tabular whitespace-nowrap">{fmtDate(r.at)}</td>
            <td className="text-xs">{r.actorRole ?? '—'}<div className="text-fg-2">{r.actorUserId?.slice(0, 8) ?? 'sistema'}</div></td>
            <td className="text-xs">{r.command ?? '—'}</td>
            <td className="text-xs">{r.action}</td>
            <td className="tabular text-xs">{r.entityId.slice(0, 8)}</td>
            <td className="max-w-md"><details><summary className="cursor-pointer text-xs font-bold">ver</summary><pre className="max-h-64 overflow-auto text-[11px] whitespace-pre-wrap">{JSON.stringify({ antes: r.before, despues: r.after }, null, 1)}</pre></details></td>
            <td className="tabular text-xs">{r.ip ?? '—'}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
