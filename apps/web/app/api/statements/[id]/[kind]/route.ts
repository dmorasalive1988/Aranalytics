import { NextResponse } from 'next/server';
import { statements } from '@pluma/services';
import { deps, getAuth } from '@/lib/server';

/** Descarga del PDF o CSV oficial. Solo el autor dueño del statement (RLS). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  const user = await (await getAuth()).getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const v = await statements.getMyStatement(deps(), user.id, id);
  const path = kind === 'pdf' ? v?.pdfPath : kind === 'csv' ? v?.csvPath : null;
  if (!v || !path) return new NextResponse(null, { status: 404 });
  const body = await deps().storage.get('documents', path.replace(/^documents\//, ''));
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': kind === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pluma-statement-${v.periodCode}.${kind}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
