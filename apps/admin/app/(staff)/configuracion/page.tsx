import { redirect } from 'next/navigation';
import { loadPlans } from '@pluma/services';
import { Card, Field, Input } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle } from '@/components/table';
import { deps, requireStaff } from '@/lib/server';
import { planAction } from '../actions';

export const metadata = { title: 'Configuración' };

/** E20 · Planes: precio anual, comisión y límite diario de postulaciones (solo super admin, auditado). */
export default async function Settings() {
  const s = await requireStaff();
  if (!s.roles.includes('super_admin')) redirect('/');
  const plans = await loadPlans(deps());
  return (
    <>
      <PageTitle title="Configuración">Cada cambio queda en la auditoría. Un precio nuevo rige desde hoy; el anterior se conserva con su vigencia.</PageTitle>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(['socio', 'pro'] as const).map((code) => {
          const p = plans[code];
          const f = p.features as { dailyApplications?: number };
          return (
            <Card key={code}>
              <h2 className="mb-4 font-display text-xl font-extrabold">{code === 'pro' ? 'Pro' : 'Socio'}</h2>
              <ActionForm action={planAction.bind(null, code)} submitLabel="Guardar" pendingLabel="Guardando…">
                <Field id={`price-${code}`} label="Precio anual (USD)"><Input id={`price-${code}`} name="price" inputMode="decimal" defaultValue={(p.amountCents / 100).toFixed(2)} /></Field>
                <Field id={`comm-${code}`} label="Comisión de administración (%)"><Input id={`comm-${code}`} name="commission" inputMode="decimal" defaultValue={(p.commissionBps / 100).toString()} /></Field>
                <Field id={`stripe-${code}`} label="ID de precio en Stripe"><Input id={`stripe-${code}`} name="stripePriceId" defaultValue={p.priceId} /></Field>
                <Field id={`daily-${code}`} label="Postulaciones diarias en la Red"><Input id={`daily-${code}`} name="daily" inputMode="numeric" defaultValue={String(f.dailyApplications ?? 0)} /></Field>
              </ActionForm>
            </Card>
          );
        })}
      </div>
    </>
  );
}
