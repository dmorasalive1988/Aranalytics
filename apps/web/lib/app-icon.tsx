import { ImageResponse } from 'next/og';

const BARS = [30, 52, 70, 84, 84, 68, 44];

/** Ícono de app (variante Ámbar: barras y raquis en Tinta) renderizado a PNG. */
export function appIcon(size: number, opts: { padding?: number; rounded?: boolean } = {}) {
  const inner = Math.round(size * (64 / 88) * (1 - (opts.padding ?? 0)));
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F2A541', borderRadius: opts.rounded ? size / 4 : 0 }}>
        <svg width={inner} height={inner} viewBox="0 0 220 220">
          <g transform="rotate(-42 110 110)">
            <path d="M8 110 L22 104 L196 108 L196 112 L22 116 Z" fill="#0E1020" />
            {BARS.map((h, i) => (
              <rect key={i} x={55 + i * 18} y={110 - h / 2} width={9} height={h} rx={4.5} fill="#0E1020" />
            ))}
          </g>
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
