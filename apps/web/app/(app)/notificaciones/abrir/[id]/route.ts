import { NextResponse, type NextRequest } from 'next/server';
import { notifications } from '@pluma/services';
import { deps, requireMember } from '@/lib/server';

/** Abre una notificación: la marca como leída y lleva a su destino dentro de la app. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await requireMember();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(new URL('/notificaciones', req.url));
  const target = (await notifications.openNotification(deps(), s.userId, id)) ?? '/notificaciones';
  // Solo rutas internas (nunca un redireccionamiento abierto).
  const safe = target.startsWith('/') && !target.startsWith('//') ? target : '/notificaciones';
  return NextResponse.redirect(new URL(safe, req.url));
}
