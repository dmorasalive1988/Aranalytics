import { catalog } from '@pluma/services';
import { Card, Field, Input, StatusPill } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle, Table } from '@/components/table';
import { fmtDate } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';
import { inviteArAction, revokeArAction } from '../sync/actions';

export const metadata = { title: 'A&R' };

const HOLD: Record<string, [string, 'ambar' | 'verde' | 'coral' | 'niebla']> = { requested: ['Solicitado', 'ambar'], active: ['Activo', 'verde'], approved: ['Aprobado', 'verde'], rejected: ['Rechazado', 'niebla'], expired: ['Vencido', 'niebla'], released: ['Liberado', 'niebla'] };

/** E18 · A&R: invitaciones (solo por invitación) y holds. */
export default async function ArAdmin() {
  const s = await requireStaff();
  const { invitations, holds } = await catalog.listArAdmin(deps(), s.id);
  const canAct = s.roles.includes('operator') || s.roles.includes('super_admin');
  const now = Date.now();
  return (
    <>
      <PageTitle title="A&R">El portal A&R es solo por invitación. El enlace es personal y vence en 14 días; revocar quita el acceso.</PageTitle>
      {canAct && (
        <Card className="max-w-xl">
          <ActionForm action={inviteArAction} submitLabel="Enviar invitación">
            <Field id="email" label="Correo del A&R"><Input id="email" name="email" type="email" required /></Field>
            <Field id="company" label="Sello o artista"><Input id="company" name="company" required /></Field>
          </ActionForm>
        </Card>
      )}
      <Table head={['Enviada', 'Correo', 'Sello o artista', 'Estado', '']} empty={invitations.length === 0 ? <p className="px-4 py-6 text-sm text-fg-2">Sin invitaciones.</p> : undefined}>
        {invitations.map((i) => {
          const state = i.revokedAt ? ['Revocada', 'niebla'] : i.acceptedUserId ? ['Aceptada', 'verde'] : new Date(i.expiresAt).getTime() < now ? ['Vencida', 'niebla'] : ['Pendiente', 'ambar'];
          return (
            <tr key={i.id}>
              <td className="tabular whitespace-nowrap">{fmtDate(i.createdAt)}</td><td className="text-xs">{i.email}</td><td>{i.company}</td>
              <td><StatusPill tone={state[1] as 'ambar'}>{state[0]}</StatusPill></td>
              <td>{canAct && !i.revokedAt && <ActionForm action={revokeArAction.bind(null, i.id)} submitLabel="Revocar" submitVariant="danger" />}</td>
            </tr>
          );
        })}
      </Table>
      <h2 className="font-display text-xl font-extrabold">Holds</h2>
      <Table head={['Pedido', 'Obra', 'Sello', 'Días', 'Hasta', 'Estado']} empty={holds.length === 0 ? <p className="px-4 py-6 text-sm text-fg-2">Sin holds.</p> : undefined}>
        {holds.map((h) => (
          <tr key={h.id}><td className="tabular whitespace-nowrap">{fmtDate(h.created_at)}</td><td>{h.title}</td><td className="text-xs">{h.company ?? '—'}</td><td className="tabular">{h.duration_days}</td><td className="tabular">{h.ends_at ? fmtDate(h.ends_at) : '—'}</td><td><StatusPill tone={HOLD[h.status]?.[1] ?? 'niebla'}>{HOLD[h.status]?.[0] ?? h.status}</StatusPill></td></tr>
        ))}
      </Table>
    </>
  );
}
