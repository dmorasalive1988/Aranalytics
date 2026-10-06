import Link from 'next/link';
import { statements } from '@pluma/services';
import { Card, Field, Input, StatusPill } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle, Table } from '@/components/table';
import { RUN_LABEL } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';
import { createPeriodAction } from './actions';

export const metadata = { title: 'Statements' };


/** E2 · Calendario oficial de pagos y estado de cada período. */
export default async function Periods() {
  await requireStaff();
  const rows = await statements.listPeriods(deps());
  return (
    <>
      <PageTitle title="Statements">Un período por fecha oficial de pago. Cada período: archivos → matching → cálculo → conciliación → aprobación → publicación.</PageTitle>
      <Card className="max-w-2xl">
        <h2 className="mb-3 font-bold">Nuevo período</h2>
        <ActionForm action={createPeriodAction} submitLabel="Crear período" pendingLabel="Creando…">
          <div className="grid grid-cols-2 gap-4">
            <Field id="code" label="Código" hint="2026-Q2, 2026-H1 o 2026-M07"><Input id="code" name="code" required hasHint /></Field>
            <Field id="payDate" label="Fecha oficial de pago"><Input id="payDate" name="payDate" type="date" required /></Field>
          </div>
        </ActionForm>
      </Card>
      <Table head={['Período', 'Fecha de pago', 'Archivos', 'Líneas', 'Estado']}>
        {rows.map((p) => (
          <tr key={p.id}>
            <td><Link href={`/statements/${p.id}`} className="font-bold">{p.code}</Link></td>
            <td className="tabular">{p.pay_date}</td>
            <td className="tabular">{p.files}</td>
            <td className="tabular">{p.lines}</td>
            <td>{p.run_status ? <StatusPill tone={RUN_LABEL[p.run_status]?.[1] ?? 'outline'}>{RUN_LABEL[p.run_status]?.[0] ?? p.run_status}</StatusPill> : <StatusPill tone="outline">Sin calcular</StatusPill>}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
