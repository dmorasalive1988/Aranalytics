import { ImageResponse } from 'next/og';
import { SITE_LANGS, dict, isSiteLang } from '@/site/i18n';

export const alt = 'Pluma';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export function generateStaticParams() {
  return SITE_LANGS.map((lang) => ({ lang }));
}

const BARBS = [18, 30, 44, 58, 70, 80, 86, 84, 76, 62, 44, 24];

/** Imagen para redes: fondo Tinta, la pluma de barras de audio y el titular en el idioma de la página. */
export default async function OgImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const d = dict(isSiteLang(lang) ? lang : 'es');
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0E1020', color: '#F4EFE6', padding: 80, position: 'relative' }}>
        <svg width="620" height="620" viewBox="0 0 220 220" style={{ position: 'absolute', right: -80, top: 10 }}>
          <g transform="rotate(-42 110 110)">
            <path d="M8 110 L22 104 L196 108 L196 112 L22 116 Z" fill="#F4EFE6" />
            {BARBS.map((h, i) => (
              <rect key={i} x={43 + i * 12} y={110 - h / 2} width={7} height={h} rx={3.5} fill="#F2A541" />
            ))}
          </g>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 720 }}>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>pluma</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1, letterSpacing: -3 }}>{d.hero.title}</div>
            <div style={{ fontSize: 36, color: '#F2A541', fontWeight: 700 }}>{d.closing.tagline}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
