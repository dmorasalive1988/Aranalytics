import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

/** Tarjeta: fondo Noche, radio 16–20, sin sombra ni bordes laterales de color. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[20px] bg-surface p-5', className)} {...rest} />;
}

/** Tarjeta destacada Ámbar (saldo). */
export function HighlightCard({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[20px] bg-ambar p-5 text-tinta', className)} {...rest} />;
}

/** Alerta (Coral) o confirmación (Verde). */
export function Notice({ tone = 'alert', title, children, icon, className }: { tone?: 'alert' | 'ok' | 'info'; title?: ReactNode; children?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div
      role={tone === 'alert' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3.5',
        tone === 'alert' && 'border-coral bg-alerta',
        tone === 'ok' && 'border-verde bg-ok',
        tone === 'info' && 'border-stroke bg-surface',
        className,
      )}
    >
      {icon && <span className={cn('mt-0.5 shrink-0', tone === 'alert' ? 'text-danger-fg' : tone === 'ok' ? 'text-ok-fg' : 'text-accent-fg')}>{icon}</span>}
      <div className="flex min-w-0 flex-col gap-1 text-sm leading-relaxed">
        {title && <strong className="text-[14px] font-bold text-fg">{title}</strong>}
        {children && <div className="text-fg-3">{children}</div>}
      </div>
    </div>
  );
}

export type PillTone = 'outline' | 'coral' | 'ambar' | 'niebla' | 'verde';

/** Píldora de estado: 11 px, peso 700, texto Tinta sobre color. */
export function StatusPill({ tone, children, icon }: { tone: PillTone; children: ReactNode; icon?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-[5px] text-[11px] font-bold leading-none whitespace-nowrap',
        tone === 'outline' && 'border border-niebla text-fg-2',
        tone === 'coral' && 'bg-coral text-tinta',
        tone === 'ambar' && 'bg-ambar text-tinta',
        tone === 'niebla' && 'bg-niebla text-tinta',
        tone === 'verde' && 'bg-verde text-tinta',
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Encabezado de pantalla del autor. */
export function ScreenTitle({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-col gap-1.5">
      {eyebrow && <span className="text-[13px] text-fg-2">{eyebrow}</span>}
      <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-fg">{title}</h1>
      {children && <p className="text-[15px] leading-relaxed text-fg-3">{children}</p>}
    </header>
  );
}

/** Pasos del onboarding: barra segmentada. */
export function StepProgress({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <div className="flex flex-col gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} aria-label={label}>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < current ? 'bg-ambar' : 'bg-stroke')} />
        ))}
      </div>
      <span className="text-xs text-fg-2">{label}</span>
    </div>
  );
}
