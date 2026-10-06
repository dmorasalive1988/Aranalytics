import { profiles } from '@pluma/services';
import { Card, Field, Input, StatusPill } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle, Table } from '@/components/table';
import { fmtDate } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';
import { hideAction, reviewCreditAction } from './actions';

export const metadata = { title: 'Red' };

const TYPE: Record<string, string> = { beat_seeks_topliner: 'Beat busca topliner', seeks_producer: 'Busca productor', seeks_verse_or_hook: 'Busca verso o coro', session_or_camp: 'Sesión o camp' };
const STATUS: Record<string, string> = { open: 'Abierta', filled: 'Cubierta', closed: 'Cerrada', expired: 'Vencida' };

/** E16 · Red: moderación de solicitudes y verificación de créditos declarados. */
export default async function NetworkAdmin({ searchParams }: { searchParams: Promise<{ q?: string; ocultas?: string }> }) {
  const s = await requireStaff();
  const f = await searchParams;
  const [requests, credits] = await Promise.all([profiles.listRequestsAdmin(deps(), s.id, { q: f.q, hidden: f.ocultas === '1' }), profiles.pendingCredits(deps(), s.id)]);
  const canModerate = s.roles.includes('operator') || s.roles.includes('super_admin');
  return (
    <>
      <PageTitle title="Red">Ocultar una solicitud la saca del tablero al instante; el autor la sigue viendo como “oculta por moderación”. Todo queda en la auditoría.</PageTitle>

      <Card className="flex flex-col gap-3">
        <h2 className="font-bold">Créditos por verificar ({credits.length})</h2>
        <p className="text-sm text-fg-2">Revisa el enlace a la plataforma y que el autor figure en los créditos. Los de obras firmadas en Pluma se verifican solos.</p>
        <Table head={['Autor', 'Canción', 'Rol', 'Enlace', 'Enviado', '', '']} empty={credits.length === 0 ? <p className="px-4 py-6 text-sm text-fg-2">No hay créditos pendientes.</p> : undefined}>
          {credits.map((c) => (
            <tr key={c.id} className="align-top">
              <td>{c.author}</td>
              <td>{c.title}{c.artist ? <span className="text-fg-2"> — {c.artist}</span> : null}</td>
              <td className="text-xs">{c.role}</td>
              <td className="text-xs">{c.dsp_url ? <a href={c.dsp_url} target="_blank" rel="noopener noreferrer">Abrir</a> : '—'}</td>
              <td className="tabular whitespace-nowrap">{fmtDate(c.created_at)}</td>
              <td>{canModerate && <ActionForm action={reviewCreditAction.bind(null, c.id, true)} submitLabel="Verificar" submitVariant="secondary" />}</td>
              <td>{canModerate && (
                <ActionForm action={reviewCreditAction.bind(null, c.id, false)} submitLabel="Rechazar" submitVariant="danger">
                  <Field id={`why-${c.id}`} label="Motivo"><Input id={`why-${c.id}`} name="reason" className="h-10" /></Field>
                </ActionForm>
              )}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <form className="flex flex-wrap items-end gap-3" role="search">
        <label className="flex flex-col gap-1 text-xs font-bold text-fg-2">
          Buscar solicitud o autor
          <input name="q" defaultValue={f.q} className="h-11 rounded-xl border border-stroke bg-surface px-3 text-sm text-fg" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="ocultas" value="1" defaultChecked={f.ocultas === '1'} className="h-5 w-5" /> Solo ocultas
        </label>
        <button className="h-11 rounded-xl bg-ambar px-4 text-sm font-bold text-tinta">Buscar</button>
      </form>
      <Table head={['Publicada', 'Solicitud', 'Autor', 'Estado', 'Postulaciones', 'Moderación']} empty={requests.length === 0 ? <p className="px-4 py-6 text-sm text-fg-2">No hay solicitudes.</p> : undefined}>
        {requests.map((r) => (
          <tr key={r.id} className="align-top">
            <td className="tabular whitespace-nowrap">{fmtDate(r.created_at)}</td>
            <td className="max-w-[340px]">
              <span className="font-bold">{r.title}</span>
              <span className="block text-xs text-fg-2">{TYPE[r.type] ?? r.type}</span>
              <span className="mt-1 block text-xs break-words text-fg-2">{r.description.slice(0, 240)}{r.description.length > 240 ? '…' : ''}</span>
            </td>
            <td>{r.author}</td>
            <td>{r.hidden_at ? <StatusPill tone="coral">Oculta</StatusPill> : <StatusPill tone={r.status === 'open' ? 'verde' : 'niebla'}>{STATUS[r.status] ?? r.status}</StatusPill>}</td>
            <td className="tabular">{r.applications}</td>
            <td className="min-w-[220px]">
              {canModerate && (r.hidden_at ? (
                <ActionForm action={hideAction.bind(null, r.id, false)} submitLabel="Volver a mostrar" submitVariant="secondary">
                  <p className="text-xs text-fg-2">Motivo: {r.hidden_reason}</p>
                </ActionForm>
              ) : (
                <ActionForm action={hideAction.bind(null, r.id, true)} submitLabel="Ocultar" submitVariant="danger">
                  <Field id={`r-${r.id}`} label="Motivo"><Input id={`r-${r.id}`} name="reason" className="h-10" /></Field>
                </ActionForm>
              ))}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
