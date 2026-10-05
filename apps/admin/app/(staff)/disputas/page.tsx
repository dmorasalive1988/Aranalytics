import Link from 'next/link';
import { admin } from '@pluma/services';
import { Field, Select, StatusPill, Textarea, buttonClass } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle, Table } from '@/components/table';
import { fmtDate } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';
import { conflictAction, resolveDisputeAction } from '../actions';

export const metadata = { title: 'Disputas y conflictos' };

/** E14 · Disputas de splits (pagos retenidos) y alertas de posible registro ajeno. */
export default async function Disputes() {
  const s = await requireStaff();
  const [disputes, conflicts] = await Promise.all([admin.listDisputes(deps(), s.id), admin.listConflicts(deps(), s.id)]);
  return (
    <>
      <PageTitle title="Disputas y conflictos">Mientras una obra está en disputa, sus regalías quedan retenidas.</PageTitle>
      <h2 className="font-display text-xl font-extrabold">Disputas</h2>
      <Table head={['Obra', 'Motivo', 'Reclamó', 'Abierta', 'Estado', 'Resolver']}>
        {disputes.map((d) => (
          <tr key={d.id}>
            <td><Link href={`/obras/${d.workId}`} className="font-bold">{d.title}</Link></td>
            <td className="max-w-xs">{d.reason === 'UNSIGNED_EXPIRED' ? 'Invitación vencida sin firma' : d.reason}</td>
            <td className="text-xs">{d.raisedByEmail ?? '—'}</td>
            <td className="tabular whitespace-nowrap">{fmtDate(d.openedAt)}</td>
            <td><StatusPill tone={d.status === 'resolved' ? 'verde' : 'coral'}>{({ open: 'Abierta', in_review: 'En revisión', resolved: 'Resuelta', withdrawn: 'Retirada' } as Record<string, string>)[d.status]}</StatusPill></td>
            <td className="min-w-72">
              {d.status === 'resolved' ? <span className="text-xs text-fg-2">{d.resolution}</span> : (
                <ActionForm action={resolveDisputeAction.bind(null, d.id)} submitLabel="Resolver" submitVariant="secondary" pendingLabel="Guardando…">
                  <Field id={`o-${d.id}`} label="Resultado">
                    <Select id={`o-${d.id}`} name="outcome"><option value="new_version">Nueva versión de splits</option><option value="reinvite">Reenviar invitaciones</option></Select>
                  </Field>
                  <Field id={`r-${d.id}`} label="Resolución"><Textarea id={`r-${d.id}`} name="resolution" required className="min-h-20" /></Field>
                </ActionForm>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <h2 className="font-display text-xl font-extrabold">Conflictos de registro</h2>
      <Table head={['Obra nueva', 'Obra existente', 'Motivo', 'Similitud', 'Estado', '']}>
        {conflicts.map((c) => (
          <tr key={c.id}>
            <td><Link href={`/obras/${c.work_id}`} className="font-bold">{c.title}</Link></td>
            <td><Link href={`/obras/${c.other_id}`}>{c.other_title}</Link></td>
            <td>{c.reason}</td>
            <td className="tabular">{Number(c.score).toFixed(2)}</td>
            <td>{c.status}</td>
            <td className="flex gap-2">
              {c.status === 'open' && (
                <>
                  <form action={conflictAction.bind(null, c.id, 'dismissed') as unknown as () => Promise<void>}><button className={buttonClass({ size: 'md', variant: 'secondary' })}>Descartar</button></form>
                  <form action={conflictAction.bind(null, c.id, 'escalated') as unknown as () => Promise<void>}><button className={buttonClass({ size: 'md', variant: 'danger' })}>Escalar</button></form>
                </>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
