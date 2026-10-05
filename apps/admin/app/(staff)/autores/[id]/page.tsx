import Link from 'next/link';
import { notFound } from 'next/navigation';
import { admin } from '@pluma/services';
import { Card, buttonClass } from '@pluma/ui';
import { PageTitle, Table } from '@/components/table';
import { WorkStatusPill, fmtDate, fmtMoney, fmtPct } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';
import { kycAction } from '../../actions';

/** E11 · Ficha del autor: perfil, membresía, contratos con evidencia, obras, saldo. */
export default async function Author({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireStaff();
  const a = await admin.getAuthor(deps(), s.id, (await params).id);
  if (!a) notFound();
  const p = a.profile;
  const balance = a.balance.reduce((acc, b) => acc + Number(b.balanceCents ?? 0), 0);
  return (
    <>
      <PageTitle title={p?.artistName || p?.legalName || a.user.email}>{p?.legalName} · {a.user.email} · {p?.country} · {p?.societyCode ?? p?.societyOther ?? '—'} {p?.ipi && `· IPI ${p.ipi}`}</PageTitle>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-2">
          <h2 className="font-bold">Membresía</h2>
          <p>{a.membership ? `${a.membership.planCode === 'pro' ? 'Pro' : 'Socio'} · ${a.membership.status}` : 'Sin plan'}</p>
          <p className="text-sm text-fg-2">Vence: {fmtDate(a.membership?.currentPeriodEnd)}{a.membership?.scheduledPlanCode && ` · baja programada a ${a.membership.scheduledPlanCode}`}</p>
          <ul className="text-sm text-fg-2">{a.periods.map((x) => <li key={x.id}>{x.planCode} · {fmtPct(x.commissionBps)} · desde {fmtDate(x.validFrom)}</li>)}</ul>
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-bold">Verificación de identidad</h2>
          <p>Estado: <strong>{a.user.kycStatus}</strong></p>
          <div className="flex flex-wrap gap-2">
            <form action={kycAction.bind(null, a.user.id, 'approved') as unknown as () => Promise<void>}><button className={buttonClass({ size: 'md' })}>Aprobar</button></form>
            <form action={kycAction.bind(null, a.user.id, 'needs_review') as unknown as () => Promise<void>}><button className={buttonClass({ size: 'md', variant: 'secondary' })}>Pedir revisión</button></form>
            <form action={kycAction.bind(null, a.user.id, 'rejected') as unknown as () => Promise<void>}><button className={buttonClass({ size: 'md', variant: 'danger' })}>Rechazar</button></form>
          </div>
          {a.guardians.length > 0 && <p className="text-sm text-fg-2">Menor de edad · tutor: {a.guardians[0]!.legalName} ({a.guardians[0]!.relationship}) · {a.guardians[0]!.email}</p>}
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="font-bold">Saldo</h2>
          <p className="tabular text-2xl font-bold">{fmtMoney(balance)}</p>
          <p className="text-sm text-fg-2">Suma del ledger (statements − pagos).</p>
        </Card>
      </div>
      <h2 className="font-display text-xl font-extrabold">Contratos firmados</h2>
      <Table head={['Versión', 'Idioma', 'Firmó', 'Método', 'IP', 'Fecha', 'SHA-256 del documento']}>
        {a.agreements.map((g) => (
          <tr key={g.id}><td>{g.version}</td><td>{g.locale}</td><td>{g.signer}</td><td>{g.method}</td><td className="tabular">{g.ip}</td><td className="tabular whitespace-nowrap">{fmtDate(g.acceptedAt)}</td><td className="tabular text-xs break-all">{g.sha}</td></tr>
        ))}
      </Table>
      <h2 className="font-display text-xl font-extrabold">Pagos de membresía</h2>
      <Table head={['Tipo', 'Monto', 'Estado', 'Factura', 'Fecha']}>
        {a.payments.map((x) => <tr key={x.id}><td>{x.kind}</td><td className="tabular">{fmtMoney(x.amountCents, x.currency)}</td><td>{x.status}</td><td className="text-xs">{x.stripeInvoiceId}</td><td className="tabular whitespace-nowrap">{fmtDate(x.occurredAt)}</td></tr>)}
      </Table>
      <h2 className="font-display text-xl font-extrabold">Obras creadas</h2>
      <Table head={['Obra', 'Estado', 'Creada']}>
        {a.works.map((w) => <tr key={w.id}><td><Link href={`/obras/${w.id}`} className="font-bold">{w.title}</Link></td><td><WorkStatusPill status={w.status} /></td><td className="tabular">{fmtDate(w.createdAt)}</td></tr>)}
      </Table>
    </>
  );
}
