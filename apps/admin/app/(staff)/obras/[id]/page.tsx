import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, t } from '@pluma/db';
import { getWorkDetail } from '@pluma/services';
import { Card, Field, Input } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle, Table } from '@/components/table';
import { WorkStatusPill, fmtDate, fmtPct } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';
import { registerAction } from '../../actions';

/** E12 · Ficha de obra: versiones de split con firmas, historial y alta con código de obra. */
export default async function Work({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const [w] = await deps().db.select({ createdBy: t.works.createdBy }).from(t.works).where(eq(t.works.id, id));
  if (!w) notFound();
  const d = (await getWorkDetail(deps(), w.createdBy, id))!;
  return (
    <>
      <PageTitle title={d.work.title}>
        <Link href={`/autores/${d.work.createdBy}`}>Ver autor</Link> · {d.work.genre} · {d.work.language} · IA: {d.work.aiDeclaration}
      </PageTitle>
      <div className="flex items-center gap-3"><WorkStatusPill status={d.work.status} /><span className="tabular text-sm text-fg-2">Código: {d.work.publisherWorkCode ?? '—'} · ISWC: {d.work.iswc ?? '—'}</span></div>
      {(d.work.status === 'sent_to_publisher' || d.work.status === 'registered') && (
        <Card className="max-w-xl">
          <h2 className="mb-3 font-bold">Alta en el registro</h2>
          <ActionForm action={registerAction.bind(null, id)} submitLabel="Marcar como registrada" pendingLabel="Guardando…">
            <Field id="code" label="Código de obra asignado"><Input id="code" name="code" defaultValue={d.work.publisherWorkCode ?? ''} required /></Field>
            <Field id="iswc" label="ISWC" optional="Opcional"><Input id="iswc" name="iswc" defaultValue={d.work.iswc ?? ''} placeholder="T-034.524.680-1" /></Field>
          </ActionForm>
        </Card>
      )}
      {d.versions.map((v) => (
        <section key={v.id} className="flex flex-col gap-2">
          <h2 className="font-display text-xl font-extrabold">Versión {v.version} · {v.status}</h2>
          <p className="tabular text-xs break-all text-fg-2">Documento: {v.splitSheetSha256 ?? '—'} · vigente desde {v.effectiveFrom ?? '—'}</p>
          <Table head={['Parte', 'Rol', '%', 'Administrada', 'Estado', 'Firmó']}>
            {v.parties.map((p) => (
              <tr key={p.shareId}><td>{p.displayName}<div className="text-xs text-fg-2">{p.email}</div></td><td>{p.role}</td><td className="tabular">{fmtPct(p.bps)}</td><td>{p.administered ? 'Sí' : 'No'}</td><td>{p.status}</td><td className="tabular">{fmtDate(p.signedAt)}</td></tr>
            ))}
          </Table>
        </section>
      ))}
      <h2 className="font-display text-xl font-extrabold">Historial</h2>
      <Table head={['Fecha', 'De', 'A', 'Nota']}>
        {d.history.map((h) => <tr key={h.id}><td className="tabular whitespace-nowrap">{fmtDate(h.at)}</td><td>{h.fromStatus ?? '—'}</td><td>{h.toStatus}</td><td>{h.note ?? ''}</td></tr>)}
      </Table>
    </>
  );
}
