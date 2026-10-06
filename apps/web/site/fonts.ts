import localFont from 'next/font/local';

/**
 * Las mismas fuentes de la app (Bricolage Grotesque y DM Sans, latín), cargadas con next/font en el sitio:
 * se precargan y el texto de respaldo se ajusta a sus medidas, para que el hero pinte rápido y sin saltos.
 */
export const display = localFont({
  src: '../../../packages/ui/node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2',
  weight: '200 800',
  display: 'swap',
  variable: '--font-site-display',
  fallback: ['system-ui', 'sans-serif'],
});

export const sans = localFont({
  src: '../../../packages/ui/node_modules/@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2',
  weight: '100 1000',
  display: 'swap',
  variable: '--font-site-sans',
  fallback: ['system-ui', 'sans-serif'],
});
