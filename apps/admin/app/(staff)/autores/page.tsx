import Link from 'next/link';
import { admin } from '@pluma/services';
import { Input, StatusPill } from '@pluma/ui';
import { PageTitle, Table } from '@/components/table';
import { fmtDate } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';

export const metadata = { title: 'Autores' };

/** E11 · Autores. */
export default async function Authors({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await requireStaff();
  const { q = '' } = await searchParams;
  const rows = await admin.listAuthors(deps(), s.id, q);
  return (
    <>
      <PageTitle title="Autores" actions={
        <form className="flex gap-2" role="search">
          <label htmlFor="q" className="sr-only">Buscar</label>
          <Input id="q" name="q" defaultValue={q} placeholder="Nombre, nombre artístico o correo" className="w-80" />
        </form>
      } />
      <Table head={['Autor', 'País', 'Sociedad', 'Plan', 'Membresía', 'KYC', 'Alta']}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td><Link href={`/autores/${r.id}`} className="font-bold">{r.artistName || r.legalName}</Link><div className="text-xs text-fg-2">{r.legalName} · {r.email}</div></td>
            <td>{r.country}</td>
            <td>{r.society ?? '—'}</td>
            <td>{r.plan === 'pro' ? 'Pro' : r.plan === 'socio' ? 'Socio' : '—'}</td>
            <td><StatusPill tone={r.status === 'active' ? 'verde' : r.status === 'past_due' ? 'ambar' : 'coral'}>{r.status ?? 'sin plan'}</StatusPill></td>
            <td>{r.kyc}</td>
            <td className="tabular whitespace-nowrap">{fmtDate(r.createdAt)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
