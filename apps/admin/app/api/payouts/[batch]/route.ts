import { NextResponse } from 'next/server';
import { payouts } from '@pluma/services';
import { deps, requireStaff } from '@/lib/server';

/** CSV del lote aprobado para carga masiva en el proveedor de pagos. Contiene datos bancarios descifrados: no se cachea. */
export async function GET(_: Request, { params }: { params: Promise<{ batch: string }> }) {
  const s = await requireStaff();
  const csv = await payouts.payoutBatchCsv(deps(), s.id, (await params).batch);
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="pluma-retiros.csv"', 'Cache-Control': 'no-store' } });
}
