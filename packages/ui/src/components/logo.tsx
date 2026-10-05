import { cn } from './cn';

/** Alturas de las 12 barbas (silueta de la pluma), de la punta al extremo. */
const BARBS = [18, 30, 44, 58, 70, 80, 86, 84, 76, 62, 44, 24];
/** Versión ícono: 7 barras más gruesas. */
const ICON_BARS = [30, 52, 70, 84, 84, 68, 44];
const QUILL = 'M8 110 L22 104 L196 108 L196 112 L22 116 Z';

interface SymbolProps {
  size?: number;
  barColor?: string;
  quillColor?: string;
  title?: string;
  className?: string;
}

/** Símbolo: pluma inclinada −42° cuyas barbas son barras de una onda de audio (lienzo 220 × 220). */
export function PlumaSymbol({ size = 40, barColor = 'var(--pl-ambar)', quillColor = 'var(--pl-papel)', title, className }: SymbolProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 220 220" className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <g transform="rotate(-42 110 110)">
        <path d={QUILL} fill={quillColor} />
        {BARBS.map((h, i) => (
          <rect key={i} x={43 + i * 12} y={110 - h / 2} width={7} height={h} rx={3.5} fill={barColor} />
        ))}
      </g>
    </svg>
  );
}

/** Ícono de app: fondo Ámbar con barras Tinta, o fondo Noche con barras Ámbar; esquinas 22 px a 88 px. */
export function PlumaAppIcon({ variant = 'ambar', size = 88, className }: { variant?: 'ambar' | 'noche'; size?: number; className?: string }) {
  const bg = variant === 'ambar' ? 'var(--pl-ambar)' : 'var(--pl-noche)';
  const bar = variant === 'ambar' ? 'var(--pl-tinta)' : 'var(--pl-ambar)';
  const quill = variant === 'ambar' ? 'var(--pl-tinta)' : 'var(--pl-papel)';
  const inner = Math.round(size * (64 / 88));
  return (
    <span className={cn('inline-flex items-center justify-center', className)} style={{ width: size, height: size, borderRadius: size / 4, background: bg }} aria-hidden>
      <svg width={inner} height={inner} viewBox="0 0 220 220">
        <g transform="rotate(-42 110 110)">
          <path d={QUILL} fill={quill} />
          {ICON_BARS.map((h, i) => (
            <rect key={i} x={55 + i * 18} y={110 - h / 2} width={9} height={h} rx={4.5} fill={bar} />
          ))}
        </g>
      </svg>
    </span>
  );
}

/** Logo completo: símbolo + wordmark "pluma" (Bricolage 800, −0,04 em), con sublogo opcional. */
export function PlumaLogo({ size = 32, product, className }: { size?: number; product?: 'sync' | 'admin'; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-fg', className)} aria-label={product ? `pluma ${product}` : 'pluma'} role="img">
      <PlumaSymbol size={size * 1.25} />
      <span className="font-display font-extrabold leading-none" style={{ fontSize: size, letterSpacing: '-0.04em' }} aria-hidden>
        pluma
        {product === 'sync' && <span className="text-ambar"> sync</span>}
        {product === 'admin' && <span className="ml-2 align-middle text-[12px] font-semibold tracking-[0.08em] text-ambar">ADMIN</span>}
      </span>
    </span>
  );
}
