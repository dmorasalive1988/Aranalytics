import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@pluma/ui';

/**
 * Gráficas de la analítica Pro (HTML/SVG del servidor, sin JavaScript en el cliente).
 * Colores por tipo de ingreso: paleta categórica validada contra el fondo Noche (orden fijo, nunca por rango).
 * Magnitudes de una sola serie (fuentes, países, matriz): un solo tono, Ámbar.
 */
export const TYPE_ORDER = ['performance', 'mechanical', 'youtube_ugc', 'sync', 'other'] as const;
export type IncomeType = (typeof TYPE_ORDER)[number];
export const TYPE_COLOR: Record<IncomeType, string> = {
  performance: '#C27F20',
  mechanical: '#6F7FEA',
  youtube_ugc: '#D45A45',
  sync: '#18A6A0',
  other: '#6B6E8C',
};

/** Variación último período vs. anterior, con flecha y signo (nunca solo color). */
export function Delta({ cur, prev, format, none }: { cur: number; prev: number | null; format: (bps: number) => string; none?: string }) {
  if (prev === null || prev === 0) return null;
  // Sin ingresos en el último período: dato neutro, no una caída en rojo.
  if (cur === 0) return none ? <span className="text-xs whitespace-nowrap text-fg-2">{none}</span> : null;
  const bps = Math.round(((cur - prev) / Math.abs(prev)) * 10_000);
  const up = bps >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-bold whitespace-nowrap', up ? 'text-ok-fg' : 'text-danger-fg')}>
      {up ? <TrendingUp size={13} strokeWidth={2.5} aria-hidden /> : <TrendingDown size={13} strokeWidth={2.5} aria-hidden />}
      {up ? '+' : '−'}
      {format(Math.abs(bps))}
    </span>
  );
}

/** Barras apiladas por período y tipo de ingreso, con leyenda y tabla accesible. */
export function StackedPeriods({ periods, labels, format, caption }: { periods: { code: string; cents: number; byType: Record<IncomeType, number> }[]; labels: Record<IncomeType, string>; format: (c: number) => string; caption: string }) {
  const used = TYPE_ORDER.filter((t) => periods.some((p) => p.byType[t] > 0));
  const max = Math.max(...periods.map((p) => used.reduce((a, t) => a + Math.max(p.byType[t], 0), 0)), 1);
  return (
    <figure className="flex flex-col gap-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-fg-3">
        {used.map((t) => (
          <li key={t} className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: TYPE_COLOR[t] }} />
            {labels[t]}
          </li>
        ))}
      </ul>
      <div className="flex h-48 items-end gap-4 sm:gap-6" aria-hidden>
        {periods.map((p, i) => (
          <div key={p.code} className="flex max-w-[96px] flex-1 flex-col items-center gap-2">
            <span className="tabular text-[11px] text-fg-3">{format(p.cents)}</span>
            <div className="flex w-full flex-col-reverse gap-[2px]" style={{ height: `${Math.max((p.cents / max) * 150, 4)}px` }}>
              {used.map((t, j) => {
                const v = Math.max(p.byType[t], 0);
                if (!v) return null;
                const top = used.slice(j + 1).every((u) => !p.byType[u]);
                return <div key={t} title={`${p.code} · ${labels[t]}: ${format(v)}`} className={cn('w-full', top && 'rounded-t-[4px]')} style={{ flexGrow: v, background: TYPE_COLOR[t] }} />;
              })}
            </div>
            <span className={cn('text-[11px]', i === periods.length - 1 ? 'font-bold text-fg' : 'text-fg-2')}>{p.code}</span>
          </div>
        ))}
      </div>
      <figcaption className="sr-only">
        {caption}
        <table>
          <thead><tr><th scope="col" />{used.map((t) => <th key={t} scope="col">{labels[t]}</th>)}</tr></thead>
          <tbody>{periods.map((p) => <tr key={p.code}><th scope="row">{p.code}</th>{used.map((t) => <td key={t}>{format(p.byType[t])}</td>)}</tr>)}</tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** Ranking horizontal (una sola serie): nombre, barra, monto, participación y variación. */
export function RankedBars({ items, format, pct, none, max = 8, color = 'var(--pl-ambar)' }: { items: { key: string; label: string; cents: number; share: number; lastCents: number; prevCents: number | null; color?: string }[]; format: (c: number) => string; pct: (bps: number) => string; none?: string; max?: number; color?: string }) {
  const shown = items.slice(0, max);
  const rest = items.slice(max);
  const top = Math.max(...shown.map((i) => i.cents), 1);
  const restCents = rest.reduce((a, r) => a + r.cents, 0);
  return (
    <ul className="flex flex-col gap-3">
      {shown.map((i) => (
        <li key={i.key} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 leading-snug font-medium">{i.label}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              <Delta cur={i.lastCents} prev={i.prevCents} format={pct} none={none} />
              <span className="tabular text-xs text-fg-2">{pct(Math.round(i.share * 10_000))}</span>
              <span className="tabular w-24 text-right font-bold">{format(i.cents)}</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#2A2D45]" aria-hidden>
            <div className="h-2 rounded-full" style={{ width: `${Math.max((i.cents / top) * 100, 1.5)}%`, background: i.color ?? color }} title={`${i.label}: ${format(i.cents)}`} />
          </div>
        </li>
      ))}
      {restCents > 0 && (
        <li className="flex justify-between text-xs text-fg-2">
          <span>+{rest.length}</span>
          <span className="tabular">{format(restCents)}</span>
        </li>
      )}
    </ul>
  );
}

/** Matriz plataforma × país: un solo tono (Ámbar) de claro a intenso según el monto; el valor siempre escrito. */
export function Heatmap({ rows, cols, cells, rowLabel, colLabel, format, corner }: { rows: string[]; cols: string[]; cells: Record<string, number>; rowLabel: (k: string) => string; colLabel: (k: string) => string; format: (c: number) => string; corner: string }) {
  const max = Math.max(...Object.values(cells), 1);
  return (
    <div className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
      <table className="w-full min-w-[560px] border-separate border-spacing-[2px] text-xs">
        <thead>
          <tr>
            <th scope="col" className="px-2 py-2 text-left font-medium text-fg-2">{corner}</th>
            {cols.map((c) => <th key={c} scope="col" className="px-2 py-2 text-center font-medium text-fg-2">{colLabel(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th scope="row" className="px-2 py-2 text-left font-medium whitespace-nowrap">{rowLabel(r)}</th>
              {cols.map((c) => {
                const v = cells[`${r}|${c}`] ?? 0;
                const a = v ? 0.14 + 0.76 * (v / max) : 0;
                return (
                  <td key={c} title={v ? `${rowLabel(r)} · ${colLabel(c)}: ${format(v)}` : undefined} className={cn('tabular rounded-[4px] px-2 py-2.5 text-center', v ? (a > 0.55 ? 'font-bold text-tinta' : 'text-fg') : 'text-fg-2')} style={{ background: v ? `rgba(242,165,65,${a.toFixed(2)})` : '#23263D' }}>
                    {v ? format(v) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Mini barras de tendencia por obra (decorativas; el valor está en la tabla). */
export function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <span aria-hidden className="inline-flex h-6 items-end gap-[2px]">
      {values.map((v, i) => (
        <span key={i} className="w-2 rounded-t-[2px]" style={{ height: `${Math.max((Math.max(v, 0) / max) * 24, 2)}px`, background: i === values.length - 1 ? 'var(--pl-ambar)' : '#3A3D57' }} />
      ))}
    </span>
  );
}
