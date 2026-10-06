import { Bell, CircleUserRound, Clapperboard, Home, Music, Users, Wallet, FileText, CircleAlert, AudioLines } from 'lucide-react';
import { Card, HighlightCard, Notice, PlumaLogo, StatusPill, cn } from '@pluma/ui';
import { PeriodBars } from '@/components/period-bars';
import type { SiteDict } from '../i18n';

/** Marco de celular para los mockups; el contenido es la app real con datos de ejemplo. */
export function Phone({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="img" aria-label={label} className={cn('relative w-full max-w-[340px] rounded-[44px] border-[10px] border-[#05060D] bg-tinta shadow-[0_0_0_1px_#3A3D57]', className)}>
      <div aria-hidden className="flex h-[700px] flex-col overflow-hidden rounded-[34px] text-papel">
        <div className="mx-auto mt-2 h-6 w-28 rounded-full bg-[#05060D]" />
        {children}
      </div>
    </div>
  );
}

const NAV_ICONS = [Home, Music, Users, Clapperboard, Wallet];

/** Inicio de la app: saldo, ingresos por período, obras y navegación inferior. */
export function DashboardMock({ d }: { d: SiteDict }) {
  const m = d.mock;
  return (
    <Phone label={`${d.transparency.dashboard.label} · ${d.example}`}>
      <div className="flex items-center justify-between px-4 pt-3">
        <PlumaLogo size={18} />
        <div className="flex gap-2">
          <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-noche">
            <Bell size={18} />
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-coral" />
          </span>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-noche">
            <CircleUserRound size={18} />
          </span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pt-4">
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <span className="text-[12px] text-fg-2">{m.hello}</span>
            <span className="font-display text-xl font-extrabold">{m.name}</span>
          </div>
          <StatusPill tone="ambar">{m.plan}</StatusPill>
        </div>
        <HighlightCard className="flex flex-col gap-1 p-4">
          <span className="text-[12px] font-medium">{m.balance}</span>
          <span className="tabular text-[30px] leading-tight font-bold tracking-[-0.02em]">{m.balanceValue}</span>
          <span className="text-[12px]">{m.nextStatement}</span>
          <span className="mt-2 inline-flex h-9 items-center justify-center rounded-xl bg-tinta text-[13px] font-bold text-papel">{m.withdraw}</span>
        </HighlightCard>
        <Card className="flex flex-col gap-2 p-4">
          <span className="text-[13px] font-bold">{m.history}</span>
          <PeriodBars data={m.periods.map(([key, v]) => ({ key: String(key), cents: Number(v) }))} label={m.history} format={(c) => String(c)} />
        </Card>
        <div className="flex flex-col">
          <span className="text-[13px] font-bold">{m.works}</span>
          {m.workRows.map(([title, status], i) => (
            <div key={title} className="flex items-center justify-between border-b border-line py-2.5">
              <span className="flex items-center gap-2 text-[13px]">
                <AudioLines size={16} className="text-fg-2" />
                {title}
              </span>
              <StatusPill tone={i === 0 ? 'verde' : 'coral'}>{status}</StatusPill>
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-around border-t border-line bg-nav px-2 pt-2 pb-4">
        {m.nav.map((label, i) => {
          const Icon = NAV_ICONS[i]!;
          return (
            <span key={label} className={cn('flex flex-col items-center gap-0.5 text-[10px]', i === 0 ? 'font-bold text-ambar' : 'text-niebla')}>
              <Icon size={18} />
              {label}
            </span>
          );
        })}
      </div>
    </Phone>
  );
}

/** Barra horizontal de participación (analítica). */
function ShareRows({ title, rows }: { title: string; rows: (string | number)[][] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold">{title}</span>
      {rows.map(([name, pct], i) => (
        <div key={String(name)} className="flex flex-col gap-1">
          <div className="flex justify-between text-[12px]">
            <span className="text-fg-3">{name}</span>
            <span className="tabular text-fg-2">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#2A2D45]">
            <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: i === 0 ? 'var(--pl-ambar)' : '#6B6E8C' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Analítica: detalle por obra, fuente y territorio, con alerta de regalías sin reclamar. */
export function AnalyticsMock({ d }: { d: SiteDict }) {
  const a = d.transparency.dashboard;
  return (
    <div role="img" aria-label={`${a.label} · ${d.example}`} className="w-full rounded-[28px] bg-tinta p-5">
      <div aria-hidden className="flex flex-col gap-5">
        <span className="font-display text-xl font-extrabold">{a.title}</span>
        <ShareRows title={a.byWork} rows={a.works} />
        <ShareRows title={a.bySource} rows={a.sources} />
        <ShareRows title={a.byTerritory} rows={a.territories} />
        <Notice tone="alert" icon={<CircleAlert size={18} />} title={a.alertTitle}>
          {a.alertBody}
        </Notice>
      </div>
    </div>
  );
}

/** Statement oficial con descarga en PDF y CSV. */
export function StatementMock({ d }: { d: SiteDict }) {
  const s = d.transparency.statement;
  return (
    <div role="img" aria-label={`${s.label} · ${d.example}`} className="w-full rounded-[28px] bg-tinta p-5">
      <div aria-hidden className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <span className="font-display text-lg font-extrabold">{s.code}</span>
            <span className="text-[12px] text-fg-2">{s.period}</span>
          </div>
          <FileText size={22} className="text-ambar" />
        </div>
        <dl className="flex flex-col text-[13px]">
          {[
            [s.gross, s.grossValue],
            [s.commission, s.commissionValue],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-line py-2.5">
              <dt className="text-fg-3">{k}</dt>
              <dd className="tabular">{v}</dd>
            </div>
          ))}
          <div className="flex justify-between py-2.5 text-[15px] font-bold">
            <dt>{s.net}</dt>
            <dd className="tabular text-ambar">{s.netValue}</dd>
          </div>
        </dl>
        <div className="flex gap-2">
          {[s.pdf, s.csv].map((f) => (
            <span key={f} className="inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-stroke text-[13px] font-bold">
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Tarjeta de solicitud de la Red, igual a la del tablero de la app. */
export function RequestCardMock({ c, featured }: { c: SiteDict['network']['cards'][number]; featured?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-[20px] bg-surface p-4 text-papel', featured && 'ring-1 ring-ambar/60')}>
      <span className="flex flex-wrap items-center gap-2">
        <StatusPill tone="outline">{c.type}</StatusPill>
      </span>
      <span className="font-display text-lg leading-snug font-extrabold">{c.title}</span>
      <span className="text-sm text-fg-2">{c.by}</span>
      <span className="text-xs text-fg-3">{c.details}</span>
      <span className="flex items-center justify-between gap-2 text-sm">
        <span className="font-bold text-accent-fg">{c.offered}</span>
        <span className="flex items-center gap-2 text-xs text-fg-3">
          <AudioLines size={16} strokeWidth={2} aria-hidden />
          {c.applications}
        </span>
      </span>
    </div>
  );
}

/** Aprobación de una licencia de sync desde la app del autor. */
export function LicenseMock({ d }: { d: SiteDict }) {
  const m = d.sync.mock;
  return (
    <div role="img" aria-label={`${m.title} · ${d.example}`} className="w-full max-w-[420px] rounded-[28px] bg-surface p-5">
      <div aria-hidden className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[12px] text-fg-2">{m.title}</span>
          <span className="font-display text-2xl font-extrabold">{m.work}</span>
          <span className="flex gap-2">
            <StatusPill tone="ambar">{m.pills[0]}</StatusPill>
            <StatusPill tone="niebla">{m.pills[1]}</StatusPill>
          </span>
        </div>
        <dl className="flex flex-col text-[13px]">
          {m.rows.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-line py-2.5">
              <dt className="text-fg-2">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <span className="text-[14px] font-bold">{m.question}</span>
        <div className="flex gap-2">
          <span className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-ambar text-[14px] font-bold text-tinta">{m.approve}</span>
          <span className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-stroke text-[14px] font-bold">{m.decline}</span>
        </div>
      </div>
    </div>
  );
}
