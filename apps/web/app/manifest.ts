import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pluma',
    short_name: 'Pluma',
    description: 'Escribe. Firma. Cobra.',
    start_url: '/inicio',
    display: 'standalone',
    background_color: '#0E1020',
    theme_color: '#0E1020',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
