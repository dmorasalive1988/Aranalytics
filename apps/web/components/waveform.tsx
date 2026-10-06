/** Forma de onda de la versión de escucha: barras redondeadas (Ámbar), decorativa. */
export function Waveform({ peaks, className }: { peaks: number[] | null; className?: string }) {
  const bars = peaks?.length ? peaks : Array.from({ length: 48 }, (_, i) => 30 + Math.round(25 * Math.abs(Math.sin(i * 0.7))));
  const w = 4;
  const gap = 2;
  return (
    <svg aria-hidden viewBox={`0 0 ${bars.length * (w + gap)} 40`} preserveAspectRatio="none" className={className ?? 'h-10 w-full'}>
      {bars.map((p, i) => {
        const h = Math.max(3, (p / 100) * 40);
        return <rect key={i} x={i * (w + gap)} y={(40 - h) / 2} width={w} height={h} rx={2} className={peaks?.length ? 'fill-ambar' : 'fill-[#3A3D57]'} />;
      })}
    </svg>
  );
}
