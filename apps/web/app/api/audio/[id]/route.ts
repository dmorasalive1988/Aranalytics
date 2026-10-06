import { NextResponse, type NextRequest } from 'next/server';
import { authorizePlay } from '@pluma/services';
import { deps, getAuth, requestCtx } from '@/lib/server';

/**
 * Escucha protegida: valida quién escucha, registra la escucha y redirige a una URL firmada de 60 s.
 * Sin sesión o sin permiso, 404 (no revela que el archivo existe).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await (await getAuth()).getUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const play = await authorizePlay(deps(), user.id, id, (await requestCtx()).ip);
  if (!play) return new NextResponse(null, { status: 404 });
  const res = NextResponse.redirect(play.url, 302);
  res.headers.set('Cache-Control', 'private, no-store');
  return res;
}
