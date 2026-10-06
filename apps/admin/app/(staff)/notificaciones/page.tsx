import Link from 'next/link';
import { notifications } from '@pluma/services';
import { Card, StatusPill } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle, Table } from '@/components/table';
import { fmtDate } from '@/components/status';
import { CHANNEL, DELIVERY_LABEL, DELIVERY_TONE, DeliveryStats } from '@/components/delivery-stats';
import { deps, requireStaff } from '@/lib/server';
import { resendAction, unsuppressAction } from './actions';

export const metadata = { title: 'Notificaciones' };

const STATUSES = ['failed', 'bounced', 'suppressed', 'sent', 'delivered', 'opened'] as const;

/** E10 · Seguimiento de envíos: entregas, rebotes y aperturas; reenvío de fallidos y lista de supresión. */
export default async function Deliveries({ searchParams }: { searchParams: Promise<{ estado?: string; canal?: string; q?: string }> }) {
  const s = await requireStaff();
  const f = await searchParams;
  const status = STATUSES.includes(f.estado as (typeof STATUSES)[number]) ? f.estado : undefined;
  const channel = f.canal && f.canal in CHANNEL ? f.canal : undefined;
  const [stats, rows, suppressions] = await Promise.all([
    notifications.deliveryStats(deps(), s.id, { sinceDays: 30 }),
    notifications.deliveryLog(deps(), s.id, { status, channel, q: f.q, limit: 200 }),
    notifications.listSuppressions(deps(), s.id),
  ]);
  const canResend = s.roles.includes('operator') || s.roles.includes('super_admin');
  const href = (p: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ estado: status, canal: channel, q: f.q, ...p }).filter((e): e is [string, string] => !!e[1]));
    return `/notificaciones${q.size ? `?${q}` : ''}`;
  };
  return (
    <>
      <PageTitle title="Notificaciones">Últimos 30 días. Los fallidos se reintentan solos cada hora (hasta 5 veces); aquí puedes forzar el reenvío.</PageTitle>
      <DeliveryStats stats={stats} />

      <form className="flex flex-wrap items-end gap-3" role="search">
        <label className="flex flex-col gap-1 text-xs font-bold text-fg-2">
          Correo o plantilla
          <input name="q" defaultValue={f.q} className="h-11 rounded-xl border border-stroke bg-surface px-3 text-sm text-fg" />
        </label>
        {status && <input type="hidden" name="estado" value={status} />}
        {channel && <input type="hidden" name="canal" value={channel} />}
        <button className="h-11 rounded-xl bg-ambar px-4 text-sm font-bold text-tinta">Buscar</button>
      </form>
      <nav aria-label="Filtros" className="flex flex-wrap gap-2 text-sm">
        <Link href={href({ estado: undefined })} aria-current={!status ? 'page' : undefined} className={!status ? 'font-bold' : ''}>Todos</Link>
        {STATUSES.map((st) => (
          <Link key={st} href={href({ estado: st })} aria-current={status === st ? 'page' : undefined} className={status === st ? 'font-bold' : ''}>{DELIVERY_LABEL[st]}</Link>
        ))}
        <span aria-hidden className="text-fg-3">|</span>
        <Link href={href({ canal: undefined })} className={!channel ? 'font-bold' : ''}>Todos los canales</Link>
        {Object.entries(CHANNEL).map(([k, v]) => (
          <Link key={k} href={href({ canal: k })} className={channel === k ? 'font-bold' : ''}>{v}</Link>
        ))}
      </nav>

      <Table head={['Fecha', 'Destinatario', 'Plantilla', 'Canal', 'Estado', 'Intentos', 'Detalle', '']} empty={rows.length === 0 ? <p className="px-4 py-6 text-sm text-fg-2">No hay envíos con estos filtros.</p> : undefined}>
        {rows.map((r) => (
          <tr key={`${r.notification_id}-${r.channel}`} className="align-top">
            <td className="tabular whitespace-nowrap">{fmtDate(r.created_at)}</td>
            <td className="text-xs">{r.email ?? '—'}</td>
            <td className="text-xs">{r.template}</td>
            <td>{CHANNEL[r.channel] ?? r.channel}</td>
            <td><StatusPill tone={DELIVERY_TONE[r.status as keyof typeof DELIVERY_TONE] ?? 'niebla'}>{DELIVERY_LABEL[r.status] ?? r.status}</StatusPill></td>
            <td className="tabular">{r.attempts}</td>
            <td className="max-w-[260px] text-xs break-words text-fg-2">{r.error ?? (r.opened_at ? `Abierto ${fmtDate(r.opened_at)}` : r.delivered_at ? `Entregado ${fmtDate(r.delivered_at)}` : '')}</td>
            <td>
              {canResend && (r.status === 'failed' || r.status === 'bounced') && (
                <ActionForm action={resendAction.bind(null, r.notification_id, r.channel as 'email')} submitLabel="Reenviar" submitVariant="secondary" pendingLabel="Enviando…" />
              )}
            </td>
          </tr>
        ))}
      </Table>

      <Card className="flex flex-col gap-3">
        <h2 className="font-bold">Lista de supresión</h2>
        <p className="text-sm text-fg-2">Direcciones con rebote permanente o queja de spam. No reciben correos (tampoco los obligatorios) hasta que alguien las libere, por ejemplo cuando el autor corrige su correo.</p>
        <Table head={['Correo', 'Motivo', 'Detalle', 'Desde', '']} empty={suppressions.length === 0 ? <p className="px-4 py-6 text-sm text-fg-2">Ninguna dirección suprimida.</p> : undefined}>
          {suppressions.map((x) => (
            <tr key={x.email} className="align-top">
              <td className="text-xs">{x.email}</td>
              <td>{x.reason === 'hard_bounce' ? 'Rebote permanente' : x.reason === 'spam_complaint' ? 'Marcó spam' : 'Manual'}</td>
              <td className="text-xs text-fg-2">{x.detail ?? '—'}</td>
              <td className="tabular">{fmtDate(x.createdAt)}</td>
              <td>{canResend && <ActionForm action={unsuppressAction.bind(null, x.email)} submitLabel="Liberar" submitVariant="secondary" />}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
