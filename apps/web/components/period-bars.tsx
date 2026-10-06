/**
 * Gráfica de ingresos: barras redondeadas en #3A3D57 con el período actual en Ámbar.
 * Valores exactos en la tabla accesible (sr-only) y en el title de cada barra.
 */
export function PeriodBars({ data, label, format }: { data: { key: string; cents: number }[]; label: string; format: (c: number) => string }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => Math.max(d.cents, 0)), 1);
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex h-28 items-end gap-3.5" aria-hidden>
        {data.map((d, i) => {
          const last = i === data.length - 1;
          return (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5" title={`${d.key}: ${format(d.cents)}`}>
              <div className="w-full rounded-md" style={{ height: `${Math.max((Math.max(d.cents, 0) / max) * 96, 4)}px`, background: last ? 'var(--pl-ambar)' : '#3A3D57' }} />
              <span className={`text-[11px] ${last ? 'text-fg' : 'text-fg-2'}`}>{d.key}</span>
            </div>
          );
        })}
      </div>
      <figcaption className="sr-only">
        {label}
        <table>
          <tbody>{data.map((d) => <tr key={d.key}><th scope="row">{d.key}</th><td>{format(d.cents)}</td></tr>)}</tbody>
        </table>
      </figcaption>
    </figure>
  );
}
