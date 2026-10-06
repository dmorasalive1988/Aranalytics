import { payouts } from '@pluma/services';
import { Card, Field, Input, StatusPill } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle, Table } from '@/components/table';
import { fmtDate, fmtMoney } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';
import { approveBatchAction, failPayoutAction, markSentAction, prepareBatchAction } from '../statements/actions';

export const metadata = { title: 'Retiros' };

const TONE = { requested: 'ambar', approved: 'ambar', sent: 'niebla', paid: 'verde', failed: 'coral', canceled: 'coral' } as const;

/** E15 · Retiros semiautomáticos: el operador arma el lote, otra persona aprueba, se paga con el proveedor y se marca. */
export default async function Payouts() {
  const s = await requireStaff();
  const rows = await payouts.listPayoutsAdmin(deps(), s.id);
  const requested = rows.filter((r) => r.status === 'requested' && !r.batchId);
  const batches = [...new Set(rows.filter((r) => r.status === 'requested' && r.batchId).map((r) => r.batchId!))];
  const approvedBatches = [...new Set(rows.filter((r) => r.status === 'approved' && r.batchId).map((r) => r.batchId!))];
  return (
    <>
      <PageTitle title="Retiros">El saldo se reserva al solicitar. Si un pago falla, el reverso lo devuelve al autor.</PageTitle>
      <Card>
        <h2 className="mb-3 font-bold">Solicitudes nuevas</h2>
        <ActionForm action={prepareBatchAction} submitLabel="Armar lote con los seleccionados" submitVariant="secondary" pendingLabel="Armando…">
          <Table head={['', 'Autor', 'Monto', 'Método', 'KYC', 'Solicitado']}>
            {requested.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" name="ids" value={r.id} aria-label={`Incluir a ${r.name}`} className="h-5 w-5" defaultChecked={r.kyc === 'approved'} /></td>
                <td>{r.name}</td><td className="tabular">{fmtMoney(Number(r.amountCents), r.currency)}</td><td className="text-xs">{r.method}</td><td>{r.kyc}</td><td className="tabular">{fmtDate(r.requestedAt)}</td>
              </tr>
            ))}
          </Table>
        </ActionForm>
      </Card>
      {batches.map((b) => (
        <Card key={b} className="flex flex-col gap-3">
          <h2 className="font-bold">Lote {b.slice(0, 8)} · por aprobar</h2>
          <p className="text-sm text-fg-2">{rows.filter((r) => r.batchId === b).length} retiros · {fmtMoney(rows.filter((r) => r.batchId === b).reduce((a, r) => a + Number(r.amountCents), 0))} · preparado por {rows.find((r) => r.batchId === b)!.preparedBy?.slice(0, 8)}</p>
          <ActionForm action={approveBatchAction.bind(null, b)} submitLabel="Aprobar lote" pendingLabel="Aprobando…" />
        </Card>
      ))}
      {approvedBatches.map((b) => (
        <Card key={b} className="flex flex-col gap-3">
          <div className="flex items-center justify-between"><h2 className="font-bold">Lote {b.slice(0, 8)} · aprobado</h2><a href={`/api/payouts/${b}`} className="font-bold">Descargar CSV para el proveedor</a></div>
          <Table head={['Autor', 'Monto', 'Método', 'Marcar pagado', 'Falló']}>
            {rows.filter((r) => r.batchId === b && r.status === 'approved').map((r) => (
              <tr key={r.id} className="align-top">
                <td>{r.name}</td><td className="tabular">{fmtMoney(Number(r.amountCents), r.currency)}</td><td className="text-xs">{r.method}</td>
                <td><ActionForm action={markSentAction.bind(null, r.id)} submitLabel="Pagado" submitVariant="secondary"><Field id={`ref-${r.id}`} label="Referencia"><Input id={`ref-${r.id}`} name="ref" required className="h-10" /></Field></ActionForm></td>
                <td><ActionForm action={failPayoutAction.bind(null, r.id)} submitLabel="Falló" submitVariant="danger"><Field id={`why-${r.id}`} label="Motivo"><Input id={`why-${r.id}`} name="reason" className="h-10" /></Field></ActionForm></td>
              </tr>
            ))}
          </Table>
        </Card>
      ))}
      <h2 className="font-display text-xl font-extrabold">Historial</h2>
      <Table head={['Autor', 'Monto', 'Estado', 'Referencia', 'Solicitado']}>
        {rows.filter((r) => !['requested', 'approved'].includes(r.status)).map((r) => (
          <tr key={r.id}><td>{r.name}</td><td className="tabular">{fmtMoney(Number(r.amountCents), r.currency)}</td><td><StatusPill tone={TONE[r.status]}>{r.status}</StatusPill></td><td className="text-xs">{r.providerRef ?? '—'}</td><td className="tabular">{fmtDate(r.requestedAt)}</td></tr>
        ))}
      </Table>
    </>
  );
}
