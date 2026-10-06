import { sql } from '@pluma/db';
import type { Deps } from './deps';

/** Fila base: lo que el autor cobró de una obra, por fuente, país y tipo de ingreso, en un período. */
export interface IncomeRow {
  period: string;
  payDate: string;
  workId: string | null;
  title: string;
  source: string;
  incomeType: 'performance' | 'mechanical' | 'youtube_ugc' | 'sync' | 'other';
  territory: string | null;
  exploitationEnd: string | null;
  grossCents: number;
  commissionCents: number;
  withholdingCents: number;
  netCents: number;
}

/** Ingresos del autor en statements publicados, con todo el detalle de las líneas (solo distribuciones pagables). */
export async function writerIncomeRows(deps: Deps, userId: string): Promise<IncomeRow[]> {
  const rows = await deps.db.execute<{ period: string; pay_date: string; work_id: string | null; title: string; source: string; income_type: IncomeRow['incomeType']; territory: string | null; exploitation_end: string | null; gross: string; commission: string; withholding: string; net: string }>(sql`
    select p.code as period, p.pay_date, w.id as work_id, coalesce(w.title, l.work_title, '—') as title, upper(trim(l.source)) as source, l.income_type,
      l.territory, max(l.exploitation_end)::text as exploitation_end,
      sum(d.gross_payout_ccy)::text as gross, sum(d.commission)::text as commission, sum(d.withholding)::text as withholding, sum(d.net)::text as net
    from writer_statements s
    join statement_periods p on p.id = s.period_id
    join distributions d on d.run_id = s.run_id and d.writer_user_id = s.writer_user_id and d.status = 'payable'
    join statement_lines l on l.id = d.line_id
    left join works w on w.id = l.matched_work_id
    where s.writer_user_id = ${userId} and s.published_at is not null
    group by p.code, p.pay_date, w.id, w.title, l.work_title, upper(trim(l.source)), l.income_type, l.territory
    order by p.pay_date`);
  const c = (v: string) => Math.round(Number(v) * 100);
  return rows.map((r) => ({
    period: r.period,
    payDate: String(r.pay_date).slice(0, 10),
    workId: r.work_id,
    title: r.title,
    source: r.source,
    incomeType: r.income_type,
    territory: r.territory,
    exploitationEnd: r.exploitation_end,
    grossCents: c(r.gross),
    commissionCents: c(r.commission),
    withholdingCents: c(r.withholding),
    netCents: c(r.net),
  }));
}

/** Nombre legible de la fuente: "APPLE MUSIC" → "Apple Music"; las siglas de sociedades quedan en mayúsculas. */
export function sourceLabel(source: string) {
  if (!/\s/.test(source) && source.length <= 6 && !['SPOTIFY', 'DEEZER', 'TIKTOK', 'TIDAL', 'YOUTUBE'].includes(source)) return source;
  const special: Record<string, string> = { YOUTUBE: 'YouTube', TIKTOK: 'TikTok' };
  return special[source] ?? source.toLowerCase().replace(/\b\p{L}/gu, (m) => m.toUpperCase());
}

/** cents y share: en el rango elegido. lastCents vs prevCents: último período del rango frente al anterior (para la variación). */
export interface Share { key: string; cents: number; share: number; lastCents: number; prevCents: number | null }

export interface AnalyticsSummary {
  periods: { code: string; payDate: string; cents: number; byType: Record<IncomeRow['incomeType'], number> }[];
  selected: string[];
  totalCents: number;
  /** Último período del rango y el anterior, para la variación. */
  lastCents: number;
  prevTotalCents: number | null;
  grossCents: number;
  commissionCents: number;
  withholdingCents: number;
  bySource: Share[];
  byCountry: Share[];
  byType: Share[];
  byWork: (Share & { workId: string | null; topSource: string | null; topCountry: string | null; trend: number[] })[];
  matrix: { sources: string[]; countries: string[]; cells: Record<string, number> };
  newCountries: string[];
  newSources: string[];
  avgLagDays: number | null;
  projectionCents: number | null;
}

const TYPES: IncomeRow['incomeType'][] = ['performance', 'mechanical', 'youtube_ugc', 'sync', 'other'];

function totals(rs: IncomeRow[], keyOf: (r: IncomeRow) => string | null) {
  const m = new Map<string, number>();
  for (const r of rs) {
    const k = keyOf(r);
    if (k) m.set(k, (m.get(k) ?? 0) + r.netCents);
  }
  return m;
}

function shares(rows: IncomeRow[], last: IncomeRow[], prev: IncomeRow[] | null, keyOf: (r: IncomeRow) => string | null): Share[] {
  const cur = totals(rows, keyOf);
  const l = totals(last, keyOf);
  const before = prev ? totals(prev, keyOf) : null;
  const total = [...cur.values()].reduce((a, b) => a + b, 0) || 1;
  return [...cur.entries()]
    .map(([key, cents]) => ({ key, cents, share: cents / total, lastCents: l.get(key) ?? 0, prevCents: before ? (before.get(key) ?? 0) : null }))
    .sort((a, b) => b.cents - a.cents);
}

/**
 * Resumen para la analítica Pro. `range` = 'all' (todos los períodos) o el código de un período;
 * la comparación es contra el período anterior (o, con 'all', entre los dos últimos).
 */
export function summarizeIncome(rows: IncomeRow[], range: string = 'all'): AnalyticsSummary {
  const periodsAll = [...new Map(rows.map((r) => [r.period, r.payDate])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const codes = periodsAll.map(([c]) => c);
  const idx = range === 'all' ? -1 : codes.indexOf(range);
  const selected = idx >= 0 ? [codes[idx]!] : codes;
  const prevCode = idx >= 0 ? codes[idx - 1] : codes.at(-2);
  const curCodes = idx >= 0 ? selected : codes.slice(-1);
  const base = rows.filter((r) => selected.includes(r.period));
  const last = rows.filter((r) => r.period === curCodes.at(-1));
  const inPrev = prevCode ? rows.filter((r) => r.period === prevCode) : null;
  const sumOf = (rs: IncomeRow[], f: (r: IncomeRow) => number) => rs.reduce((a, r) => a + f(r), 0);
  const share = (keyOf: (r: IncomeRow) => string | null) => shares(base, last, inPrev, keyOf);

  const bySource = share((r) => r.source);
  const byCountry = share((r) => r.territory);
  const byType = share((r) => r.incomeType);
  const byWork = share((r) => r.workId ?? r.title).map((w) => {
    const rs = base.filter((r) => (r.workId ?? r.title) === w.key);
    const top = (f: (r: IncomeRow) => string | null) => shares(rs, [], null, f)[0]?.key ?? null;
    return {
      ...w,
      key: rs[0]!.title,
      workId: rs[0]!.workId,
      topSource: top((r) => r.source),
      topCountry: top((r) => r.territory),
      trend: codes.map((c) => sumOf(rows.filter((r) => r.period === c && (r.workId ?? r.title) === w.key), (r) => r.netCents)),
    };
  });

  const topSources = bySource.slice(0, 6).map((s) => s.key);
  const topCountries = byCountry.slice(0, 6).map((s) => s.key);
  const cells: Record<string, number> = {};
  for (const r of base) {
    if (!r.territory || !topSources.includes(r.source) || !topCountries.includes(r.territory)) continue;
    const k = `${r.source}|${r.territory}`;
    cells[k] = (cells[k] ?? 0) + r.netCents;
  }

  // Novedades del período actual frente a toda la historia anterior.
  const lastCode = curCodes.at(-1);
  const history = rows.filter((r) => lastCode && codes.indexOf(r.period) < codes.indexOf(lastCode));
  const seen = (f: (r: IncomeRow) => string | null) => new Set(history.map(f).filter(Boolean) as string[]);
  const fresh = (f: (r: IncomeRow) => string | null) => (history.length ? [...new Set(last.map(f).filter(Boolean) as string[])].filter((k) => !seen(f).has(k)) : []);

  // Tiempo entre el fin de la explotación y el pago, ponderado por monto.
  let lagW = 0;
  let lagSum = 0;
  for (const r of base) {
    if (!r.exploitationEnd || r.netCents <= 0) continue;
    const days = (Date.parse(r.payDate) - Date.parse(r.exploitationEnd)) / 86_400_000;
    if (days < 0) continue;
    lagSum += days * r.netCents;
    lagW += r.netCents;
  }

  const periodTotals = periodsAll.map(([code, payDate]) => {
    const rs = rows.filter((r) => r.period === code);
    const byT = Object.fromEntries(TYPES.map((t) => [t, sumOf(rs.filter((r) => r.incomeType === t), (r) => r.netCents)])) as Record<IncomeRow['incomeType'], number>;
    return { code, payDate, cents: sumOf(rs, (r) => r.netCents), byType: byT };
  });
  const recent = periodTotals.slice(-3).map((p) => p.cents);

  return {
    periods: periodTotals,
    selected,
    totalCents: sumOf(base, (r) => r.netCents),
    lastCents: sumOf(last, (r) => r.netCents),
    prevTotalCents: inPrev ? sumOf(inPrev, (r) => r.netCents) : null,
    grossCents: sumOf(base, (r) => r.grossCents),
    commissionCents: sumOf(base, (r) => r.commissionCents),
    withholdingCents: sumOf(base, (r) => r.withholdingCents),
    bySource,
    byCountry,
    byType,
    byWork,
    matrix: { sources: topSources, countries: topCountries, cells },
    newCountries: fresh((r) => r.territory),
    newSources: fresh((r) => r.source),
    avgLagDays: lagW ? Math.round(lagSum / lagW) : null,
    projectionCents: recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : null,
  };
}

/** CSV con el detalle (una fila por período, obra, fuente, país y tipo), para Excel o Sheets. */
export function incomeCsv(rows: IncomeRow[]) {
  const esc = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const usd = (c: number) => (c / 100).toFixed(2);
  const head = ['period', 'pay_date', 'work', 'source', 'income_type', 'country', 'gross_usd', 'commission_usd', 'withholding_usd', 'net_usd'];
  const lines = rows.map((r) => [r.period, r.payDate, r.title, sourceLabel(r.source), r.incomeType, r.territory, usd(r.grossCents), usd(r.commissionCents), usd(r.withholdingCents), usd(r.netCents)].map(esc).join(','));
  return [head.join(','), ...lines].join('\n') + '\n';
}
