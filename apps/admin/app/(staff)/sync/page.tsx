import Link from 'next/link';
import { catalog } from '@pluma/services';
import { Card, Field, Input, Select, StatusPill, Textarea } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle, Table } from '@/components/table';
import { fmtDate, fmtMoney } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';
import { licenseStatusAction, operatorBriefAction } from './actions';

export const metadata = { title: 'Sync' };

const STATUS: Record<string, [string, 'ambar' | 'verde' | 'coral' | 'niebla']> = {
  submitted: ['Enviada', 'ambar'], awaiting_writers: ['Esperando autores', 'ambar'], writers_approved: ['Aprobada por autores', 'verde'], writers_rejected: ['Rechazada por autores', 'coral'],
  negotiating: ['En negociación', 'ambar'], issued: ['Emitida', 'verde'], canceled: ['Cancelada', 'niebla'],
};
const USAGE: Record<string, string> = { social_media: 'Redes sociales', digital_ads: 'Publicidad digital', tv_film: 'TV y cine', videogame: 'Videojuego', other: 'Otro' };

/** E17 · Sync: licencias (negociar, emitir), briefs y tarifas referenciales. */
export default async function SyncAdmin({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const s = await requireStaff();
  const { estado } = await searchParams;
  const [licenses, briefs] = await Promise.all([catalog.listLicensesAdmin(deps(), s.id, estado && estado in STATUS ? estado : undefined), catalog.listBriefsAdmin(deps(), s.id)]);
  const canAct = s.roles.includes('operator') || s.roles.includes('super_admin');
  return (
    <>
      <PageTitle title="Sync">Una licencia se puede emitir solo cuando todos los autores socios la aprobaron. La comisión de Pluma (ajustable en Configuración) queda registrada en cada solicitud.</PageTitle>
      <nav aria-label="Filtros" className="flex flex-wrap gap-3 text-sm">
        <Link href="/sync" className={!estado ? 'font-bold' : ''}>Todas</Link>
        {Object.entries(STATUS).map(([k, [label]]) => <Link key={k} href={`/sync?estado=${k}`} className={estado === k ? 'font-bold' : ''}>{label}</Link>)}
      </nav>
      <Table head={['Fecha', 'Obra', 'Comprador', 'Uso · territorio · plazo', 'Cotización', 'Autores', 'Estado', 'Acción']} empty={licenses.length === 0 ? <p className="px-4 py-6 text-sm text-fg-2">No hay solicitudes.</p> : undefined}>
        {licenses.map((r) => (
          <tr key={r.id} className="align-top">
            <td className="tabular whitespace-nowrap">{fmtDate(r.created_at)}</td>
            <td className="min-w-[200px] max-w-[280px]"><span className="font-bold">{r.title}</span><span className="mt-1 block text-xs break-words text-fg-2">{r.project_description.slice(0, 180)}</span></td>
            <td className="text-xs">{r.company}<br />{r.buyer_email}</td>
            <td className="text-xs">{USAGE[r.usage] ?? r.usage} · {r.territory} · {r.term_months} m{r.one_stop_requested ? ' · one-stop' : ''}</td>
            <td className="tabular text-xs">{fmtMoney(Number(r.quote_min_cents))} – {fmtMoney(Number(r.quote_max_cents))}{r.final_fee_cents ? <><br /><b>Final {fmtMoney(Number(r.final_fee_cents))}</b> · comisión {(r.pluma_commission_bps ?? 0) / 100} %</> : null}</td>
            <td className="tabular">{r.approvals}</td>
            <td><StatusPill tone={STATUS[r.status]?.[1] ?? 'niebla'}>{STATUS[r.status]?.[0] ?? r.status}</StatusPill></td>
            <td className="min-w-[220px]">
              {canAct && r.status === 'writers_approved' && <ActionForm action={licenseStatusAction.bind(null, r.id, 'negotiating')} submitLabel="Pasar a negociación" submitVariant="secondary"><Field id={`n-${r.id}`} label="Nota para el comprador"><Input id={`n-${r.id}`} name="note" className="h-10" /></Field></ActionForm>}
              {canAct && ['writers_approved', 'negotiating'].includes(r.status) && (
                <ActionForm action={licenseStatusAction.bind(null, r.id, 'issued')} submitLabel="Emitir licencia"><Field id={`f-${r.id}`} label="Tarifa final (USD)"><Input id={`f-${r.id}`} name="fee" inputMode="decimal" className="h-10" /></Field></ActionForm>
              )}
              {canAct && ['submitted', 'awaiting_writers', 'writers_approved', 'negotiating'].includes(r.status) && <ActionForm action={licenseStatusAction.bind(null, r.id, 'canceled')} submitLabel="Cancelar" submitVariant="danger" />}
            </td>
          </tr>
        ))}
      </Table>

      <h2 className="font-display text-xl font-extrabold">Briefs</h2>
      <div className="grid items-start gap-4 lg:grid-cols-[2fr_1fr]">
        <Table head={['Fecha', 'Brief', 'Publicó', 'Uso', 'Obras', 'Estado']} empty={briefs.length === 0 ? <p className="px-4 py-6 text-sm text-fg-2">No hay briefs.</p> : undefined}>
          {briefs.map((b) => (
            <tr key={b.id}><td className="tabular whitespace-nowrap">{fmtDate(b.created_at)}</td><td>{b.title}</td><td className="text-xs">{b.company}</td><td className="text-xs">{USAGE[b.usage] ?? b.usage} · {b.territory}</td><td className="tabular">{b.submissions}</td><td>{b.status === 'open' ? 'Abierto' : 'Cerrado'}</td></tr>
          ))}
        </Table>
        {canAct && (
          <Card>
            <h3 className="mb-3 font-bold">Publicar brief como Pluma</h3>
            <ActionForm action={operatorBriefAction} submitLabel="Publicar brief" submitVariant="secondary">
              <Field id="b-title" label="Título"><Input id="b-title" name="title" required /></Field>
              <Field id="b-desc" label="Qué se busca"><Textarea id="b-desc" name="description" rows={3} required /></Field>
              <Field id="b-genres" label="Géneros (separados por coma)"><Input id="b-genres" name="genres" /></Field>
              <Field id="b-usage" label="Uso"><Select id="b-usage" name="usage">{Object.entries(USAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
              <Field id="b-terr" label="Territorio"><Select id="b-terr" name="territory"><option value="LATAM">Latinoamérica</option><option value="US">Estados Unidos</option><option value="WORLD">Mundial</option></Select></Field>
              <Field id="b-dl" label="Cierra el"><Input id="b-dl" name="deadline" type="date" /></Field>
            </ActionForm>
          </Card>
        )}
      </div>
      <p className="text-xs text-fg-2">Tarifas del cotizador: tabla <b>referencial</b> por uso y territorio (12 meses), ajustada por plazo (3 m ×0,5 · 6 m ×0,7 · 24 m ×1,6 · 36 m ×2) y one-stop (×1,8). Se reemplaza con la tabla real en <code>sync_rate_card</code>.</p>
    </>
  );
}
