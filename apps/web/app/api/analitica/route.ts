import { NextResponse } from 'next/server';
import { analytics, getSession } from '@pluma/services';
import { hasAnalytics } from '@/lib/plan-features';
import { deps, getAuth } from '@/lib/server';

/** CSV de la analítica Pro: una fila por período, obra, fuente, país y tipo de ingreso. */
export async function GET(req: Request) {
  const user = await (await getAuth()).getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const s = await getSession(deps(), user.id);
  if (!s?.membership || !hasAnalytics(s.membership)) return new NextResponse(null, { status: 403 });
  const periodo = new URL(req.url).searchParams.get('periodo');
  const rows = (await analytics.writerIncomeRows(deps(), user.id)).filter((r) => !periodo || r.period === periodo);
  return new NextResponse('﻿' + analytics.incomeCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pluma-analitica${periodo ? `-${periodo}` : ''}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
