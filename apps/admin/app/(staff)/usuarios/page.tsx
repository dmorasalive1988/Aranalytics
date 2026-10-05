import { redirect } from 'next/navigation';
import { admin } from '@pluma/services';
import { Card, Field, Input, Select, buttonClass } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle, Table } from '@/components/table';
import { fmtDate } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';
import { grantAction, revokeAction } from '../actions';

export const metadata = { title: 'Usuarios internos' };

/** E21 · Roles internos (operador, aprobador, super admin). Todos con segundo factor obligatorio. */
export default async function Staff() {
  const s = await requireStaff();
  if (!s.roles.includes('super_admin')) redirect('/');
  const rows = await admin.listStaff(deps(), s.id);
  return (
    <>
      <PageTitle title="Usuarios internos">La persona debe tener cuenta en Pluma. Al recibir un rol, se le exige segundo factor.</PageTitle>
      <Card className="max-w-xl">
        <ActionForm action={grantAction} submitLabel="Asignar rol" pendingLabel="Guardando…">
          <Field id="email" label="Correo"><Input id="email" name="email" type="email" required /></Field>
          <Field id="role" label="Rol"><Select id="role" name="role"><option value="operator">Operador</option><option value="approver">Aprobador</option><option value="super_admin">Super admin</option></Select></Field>
        </ActionForm>
      </Card>
      <Table head={['Correo', 'Rol', 'Desde', '']}>
        {rows.map((r) => (
          <tr key={`${r.userId}-${r.role}`}>
            <td>{r.email}</td><td>{r.role}</td><td className="tabular">{fmtDate(r.grantedAt)}</td>
            <td><form action={revokeAction.bind(null, r.userId, r.role as admin.StaffRole) as unknown as () => Promise<void>}><button className={buttonClass({ size: 'md', variant: 'danger' })}>Quitar</button></form></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
