import { NextResponse } from 'next/server';
import { eq, t } from '@pluma/db';
import { deps, requireStaff } from '@/lib/server';

/** Descarga de una exportación ya generada (archivo inmutable en almacenamiento). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const [s] = await deps().db.select().from(t.publisherSubmissions).where(eq(t.publisherSubmissions.id, (await params).id));
  if (!s) return new NextResponse(null, { status: 404 });
  const [bucket, ...rest] = s.filePath.split('/');
  const body = await deps().storage.get(bucket as 'documents', rest.join('/'));
  return new NextResponse(new Uint8Array(body), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${rest.at(-1)}"`, 'Cache-Control': 'no-store' } });
}
