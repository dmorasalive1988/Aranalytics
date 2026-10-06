import { Card } from '@pluma/ui';

export const DELIVERY_TONE = { queued: 'niebla', scheduled: 'niebla', sent: 'niebla', delivered: 'verde', opened: 'verde', bounced: 'coral', failed: 'coral', suppressed: 'ambar' } as const;
export const DELIVERY_LABEL: Record<string, string> = { queued: 'En cola', scheduled: 'Programado', sent: 'Enviado', delivered: 'Entregado', opened: 'Abierto', bounced: 'Rebotó', failed: 'Falló', suppressed: 'Suprimido' };
export const CHANNEL: Record<string, string> = { email: 'Correo', push: 'Push', whatsapp: 'WhatsApp' };

/** Resumen por canal: enviados, entregados, abiertos, rebotes y fallos. */
export function DeliveryStats({ stats }: { stats: Record<string, Record<string, number>> }) {
  const channels = Object.keys(stats);
  if (!channels.length) return <p className="text-sm text-fg-2">Sin envíos todavía.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {channels.map((c) => {
        const s = stats[c]!;
        const total = Object.values(s).reduce((a, b) => a + b, 0);
        const ok = (s.sent ?? 0) + (s.delivered ?? 0) + (s.opened ?? 0);
        return (
          <Card key={c} className="flex flex-col gap-1">
            <span className="text-xs font-bold tracking-[0.06em] text-fg-2 uppercase">{CHANNEL[c] ?? c}</span>
            <span className="tabular font-display text-2xl font-extrabold">{ok} / {total}</span>
            <span className="tabular text-xs text-fg-2">
              {[s.delivered && `${s.delivered} entregados`, s.opened && `${s.opened} abiertos`, s.bounced && `${s.bounced} rebotes`, s.failed && `${s.failed} fallidos`, s.suppressed && `${s.suppressed} suprimidos`].filter(Boolean).join(' · ') || 'Todo enviado'}
            </span>
          </Card>
        );
      })}
    </div>
  );
}

