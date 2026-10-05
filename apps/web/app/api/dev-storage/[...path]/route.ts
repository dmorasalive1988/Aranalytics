import { NextResponse, type NextRequest } from 'next/server';
import { localStorageAdapter } from '@pluma/services';

/** Sirve archivos del almacenamiento local de desarrollo con URL firmada y caducidad. Desactivado en producción. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });
  const [bucket, ...rest] = (await params).path;
  const path = rest.join('/');
  const exp = Number(req.nextUrl.searchParams.get('exp'));
  const sig = req.nextUrl.searchParams.get('sig') ?? '';
  const store = localStorageAdapter();
  if (!bucket || !store.verify(bucket, path, exp, sig)) return new NextResponse(null, { status: 403 });
  const body = await store.get(bucket as 'documents', path).catch(() => null);
  if (!body) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(body), { headers: { 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline' } });
}
