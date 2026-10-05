import Link from 'next/link';
import { sql } from '@pluma/db';
import { Notice } from '@pluma/ui';
import { PageTitle } from '@/components/table';
import { deps, requireStaff } from '@/lib/server';

export const metadata = { title: 'Inicio' };

/** E1 · Colas pendientes del equipo de operaciones. */
export default async function Dashboard() {
  await requireStaff();
  const [counts] = await deps().db.execute<Record<string, number>>(sql`select
    (select count(*)::int from works where status = 'awaiting_signatures') as awaiting,
    (select count(*)::int from works where status = 'splits_signed') as to_export,
    (select count(*)::int from works where status = 'sent_to_publisher') as sent,
    (select count(*)::int from works where status = 'registered') as registered,
    (select count(*)::int from disputes where status = 'open') as disputes,
    (select count(*)::int from work_conflicts where status = 'open') as conflicts,
    (select count(*)::int from users where kyc_status in ('pending', 'needs_review')) as kyc,
    (select count(*)::int from memberships where status = 'active') as members,
    (select count(*)::int from notification_deliveries where status = 'failed') as failed_mail,
    audit_verify_chain() as chain_broken`);
  const c = counts!;
  const cards: [string, number, string][] = [
    ['Splits firmados por exportar', c.to_export!, '/exportar'],
    ['Enviadas a registro sin código', c.sent!, '/obras?status=sent_to_publisher'],
    ['Disputas abiertas', c.disputes!, '/disputas'],
    ['Conflictos por revisar', c.conflicts!, '/disputas'],
    ['Esperando firmas', c.awaiting!, '/obras?status=awaiting_signatures'],
    ['Registradas', c.registered!, '/obras?status=registered'],
    ['Socios activos', c.members!, '/autores'],
    ['Correos fallidos', c.failed_mail!, '/auditoria'],
  ];
  return (
    <>
      <PageTitle title="Inicio">Colas de trabajo del día.</PageTitle>
      {c.chain_broken ? (
        <Notice tone="alert" title={`La cadena de auditoría está rota en la fila ${c.chain_broken}. Escala de inmediato.`} />
      ) : (
        <Notice tone="ok" title="Cadena de auditoría íntegra." />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, n, href]) => (
          <Link key={label} href={href} className="flex flex-col gap-1 rounded-2xl bg-surface p-5 text-fg no-underline hover:outline-2 hover:outline-ambar">
            <span className="text-[13px] text-fg-2">{label}</span>
            <span className="tabular text-[28px] font-bold">{n}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
