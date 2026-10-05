import type { ReactNode } from 'react';

/** Tabla del back-office: encabezado 12 px con interletrado, filas 14 px, desplazamiento horizontal en su caja. */
export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs tracking-[0.06em] text-fg-2 uppercase">
            {head.map((h, i) => <th key={i} scope="col" className="border-b border-[#E6E0D4] px-4 py-3 font-bold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="[&>tr>td]:border-b [&>tr>td]:border-line [&>tr>td]:px-4 [&>tr>td]:py-3 [&>tr:last-child>td]:border-0">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function PageTitle({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[34px] leading-tight font-extrabold">{title}</h1>
        {children && <p className="text-sm text-fg-2">{children}</p>}
      </div>
      {actions}
    </div>
  );
}
