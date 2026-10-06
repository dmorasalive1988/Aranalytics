import Link from 'next/link';
import { leads } from '@pluma/services';
import { PageTitle, Table } from '@/components/table';
import { fmtDate } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';

export const metadata = { title: 'Contactos del sitio' };

const KINDS = { waitlist: 'Lista de espera', sync: 'Compradores de sync', ar: 'A&R' } as const;
type Kind = keyof typeof KINDS;

/** Contactos del sitio público: lista de espera y formularios de sync y A&R. */
export default async function Leads({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  await requireStaff();
  const { tipo } = await searchParams;
  const kind = tipo && tipo in KINDS ? (tipo as Kind) : undefined;
  const [rows, counts] = await Promise.all([leads.listLeads(deps(), kind), leads.leadCounts(deps())]);
  return (
    <>
      <PageTitle title="Contactos del sitio">Correos de la lista de espera y solicitudes de compradores de sync y A&Rs. Cada uno avisa por correo al equipo.</PageTitle>
      <nav aria-label="Tipo" className="flex flex-wrap gap-2 text-sm">
        <Link href="/contactos" aria-current={!kind ? 'page' : undefined} className={`rounded-full px-3 py-1.5 font-bold no-underline ${!kind ? 'bg-tinta text-papel' : 'bg-surface text-fg'}`}>Todos</Link>
        {(Object.keys(KINDS) as Kind[]).map((k) => (
          <Link key={k} href={`/contactos?tipo=${k}`} aria-current={kind === k ? 'page' : undefined} className={`rounded-full px-3 py-1.5 font-bold no-underline ${kind === k ? 'bg-tinta text-papel' : 'bg-surface text-fg'}`}>
            {KINDS[k]} ({counts[k] ?? 0})
          </Link>
        ))}
      </nav>
      <Table head={['Fecha', 'Tipo', 'Correo', 'Nombre', 'Empresa', 'Plan', 'Idioma', 'Mensaje']} empty={rows.length === 0 ? <p className="px-4 py-6 text-sm text-fg-2">Sin contactos todavía.</p> : undefined}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="tabular whitespace-nowrap">{fmtDate(r.createdAt)}</td>
            <td>{KINDS[r.kind as Kind]}</td>
            <td className="text-xs">{r.email}</td>
            <td>{r.name ?? '—'}</td>
            <td>{r.company ?? '—'}</td>
            <td>{r.plan ?? '—'}</td>
            <td className="uppercase">{r.lang}</td>
            <td className="max-w-[320px] text-xs">{r.message ?? '—'}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
