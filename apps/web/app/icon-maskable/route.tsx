import { appIcon } from '@/lib/app-icon';

/** Ícono "maskable": con margen de seguridad para recortes circulares de Android. */
export function GET() {
  return appIcon(512, { padding: 0.25 });
}
