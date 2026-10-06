import { connectorFor, detectConnector, type NormalizedLine } from '@pluma/connectors';
import { and, asc, desc, eq, inArray, isNull, ne, notInArray, t, withSystem, withUser, sql, type Tx } from '@pluma/db';
import {
  D,
  DomainError,
  applicableVersion,
  commissionAt,
  dec,
  distributeLine,
  normalizeTitle,
  parseMoneyInput,
  reconcile,
  titleSimilarity,
  type DistributionRow,
  type PlanCode,
  type WriterTerms,
} from '@pluma/domain';
import { sha256 } from './crypto';
import type { Deps, RequestCtx } from './deps';
import { emit } from './events';
import { PUBLISHER_ID } from './onboarding';
import * as admin from './admin';

const PROVIDER = 'primary_administrator';

async function staff(deps: Deps, userId: string, allowed: admin.StaffRole[]) {
  const roles = await admin.staffRoles(deps, userId);
  const role = roles.find((r) => allowed.includes(r));
  if (!role) throw new DomainError('FORBIDDEN');
  return role;
}
const ctxFor = (userId: string, role: admin.StaffRole, command: string, ctx: RequestCtx) => ({ actorId: userId, actorRole: role, command, ...ctx });

/* -------------------------------- Períodos -------------------------------- */

export async function createPeriod(deps: Deps, staffId: string, input: { code: string; payDate: string }, ctx: RequestCtx) {
  const role = await staff(deps, staffId, ['operator', 'super_admin']);
  if (!/^\d{4}-(Q[1-4]|H[12]|M(0[1-9]|1[0-2]))$/.test(input.code)) throw new DomainError('PERIOD_CODE_INVALID');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.payDate)) throw new DomainError('PAY_DATE_INVALID');
  const [p] = await withSystem(deps.db, ctxFor(staffId, role, 'statement.create_period', ctx), (tx) =>
    tx.insert(t.statementPeriods).values({ publisherId: PUBLISHER_ID, provider: PROVIDER, code: input.code, payDate: input.payDate }).onConflictDoNothing().returning({ id: t.statementPeriods.id }),
  );
  if (!p) throw new DomainError('PERIOD_EXISTS');
  return p.id;
}

export async function listPeriods(deps: Deps) {
  return deps.db.execute<{ id: string; code: string; pay_date: string; files: number; lines: number; run_status: string | null; run_id: string | null; published_at: string | null }>(sql`
    select p.id, p.code, p.pay_date,
      (select count(*)::int from statement_files f where f.period_id = p.id and f.status <> 'superseded') as files,
      (select coalesce(sum(f.line_count), 0)::int from statement_files f where f.period_id = p.id and f.status <> 'superseded') as lines,
      r.status as run_status, r.id as run_id, r.published_at
    from statement_periods p
    left join lateral (select * from distribution_runs r where r.period_id = p.id and r.status <> 'invalidated' order by r.calculated_at desc nulls last limit 1) r on true
    order by p.pay_date desc`);
}

/** Próximo statement oficial: solo fechas del calendario cargado, nunca un estimado. */
export async function nextOfficialStatement(deps: Deps) {
  const [p] = await deps.db.select().from(t.statementPeriods).where(sql`${t.statementPeriods.payDate} >= ${deps.now().toISOString().slice(0, 10)}`).orderBy(asc(t.statementPeriods.payDate)).limit(1);
  const [published] = await deps.db.execute<{ id: string }>(sql`select r.id from distribution_runs r where r.period_id = ${p?.id ?? null} and r.status = 'published' limit 1`);
  return p && !published ? { code: p.code, payDate: p.payDate } : null;
}

/* --------------------------------- Ingesta -------------------------------- */

/**
 * Paso 1–2: guarda el archivo crudo (inmutable, con sha256 y versión), lo normaliza con el conector
 * y corre el matching. El monto efectivamente recibido en el banco se ingresa al calcular.
 */
export async function uploadStatement(deps: Deps, staffId: string, input: { periodId: string; fileName: string; bytes: Buffer }, ctx: RequestCtx) {
  const role = await staff(deps, staffId, ['operator', 'super_admin']);
  const text = input.bytes.toString('utf8');
  const connector = detectConnector(text);
  if (!connector) throw new DomainError('STATEMENT_FORMAT_UNKNOWN');
  const parsed = connector.parse(input.bytes);
  if (parsed.lines.length === 0) throw new DomainError('STATEMENT_EMPTY', { errors: parsed.errors.slice(0, 5) });
  const [period] = await deps.db.select().from(t.statementPeriods).where(eq(t.statementPeriods.id, input.periodId));
  if (!period) throw new DomainError('PERIOD_NOT_FOUND');
  await assertPeriodOpen(deps, period.id);
  const hash = sha256(input.bytes);
  const [dup] = await deps.db.select({ id: t.statementFiles.id }).from(t.statementFiles).where(and(eq(t.statementFiles.periodId, period.id), eq(t.statementFiles.sha256, hash)));
  if (dup) throw new DomainError('FILE_ALREADY_UPLOADED');
  const path = `${connector.provider}/${period.code}/${hash}.csv`;
  await deps.storage.putOnce('statements-raw', path, input.bytes, 'text/csv').catch((e: Error) => {
    if (e.message !== 'OBJECT_EXISTS') throw e;
  });

  const fileId = await withSystem(deps.db, ctxFor(staffId, role, 'statement.upload', ctx), async (tx) => {
    const [{ v }] = (await tx.execute<{ v: number }>(sql`select coalesce(max(version), 0)::int + 1 as v from statement_files where period_id = ${period.id}`)) as unknown as [{ v: number }];
    const [f] = await tx
      .insert(t.statementFiles)
      .values({
        periodId: period.id,
        provider: connector.provider,
        version: v,
        storagePath: `statements-raw/${path}`,
        sha256: hash,
        originalName: input.fileName.slice(0, 200),
        mappingVersion: connector.mappingVersion,
        controlTotal: parsed.controlTotals.USD ?? null,
        controlTotals: parsed.controlTotals,
        parseErrors: parsed.errors,
        lineCount: parsed.lines.length,
        receivedAmount: parsed.controlTotals.USD ?? '0', // declarado por el archivo; lo recibido en banco va en la corrida
        receivedCurrency: 'USD',
        status: 'normalized',
        uploadedBy: staffId,
      })
      .returning({ id: t.statementFiles.id });
    for (let i = 0; i < parsed.lines.length; i += 500) {
      await tx.insert(t.statementLines).values(parsed.lines.slice(i, i + 500).map((l) => lineRow(f!.id, l)));
    }
    await invalidateLiveRun(tx, period.id, 'nuevo archivo');
    return f!.id;
  });
  const matching = await runMatching(deps, fileId);
  return { fileId, lines: parsed.lines.length, errors: parsed.errors, matching };
}

const lineRow = (fileId: string, l: NormalizedLine) => ({
  fileId,
  lineNo: l.lineNo,
  raw: l.raw,
  providerWorkCode: l.providerWorkCode,
  workTitle: l.workTitle,
  iswc: l.iswc,
  writerIpi: l.writerIpi,
  isrc: l.isrc,
  source: l.source,
  incomeType: l.incomeType,
  territory: l.territory,
  exploitationStart: l.exploitationStart,
  exploitationEnd: l.exploitationEnd,
  payPeriod: l.payPeriod,
  currency: l.currency,
  gross: l.gross,
  providerFee: l.providerFee,
  net: l.net,
  isAdjustment: l.isAdjustment,
  adjustsPeriod: l.adjustsPeriod,
});

async function assertPeriodOpen(deps: Deps, periodId: string) {
  const [r] = await deps.db.select({ id: t.distributionRuns.id }).from(t.distributionRuns).where(and(eq(t.distributionRuns.periodId, periodId), eq(t.distributionRuns.status, 'published')));
  if (r) throw new DomainError('PERIOD_ALREADY_PUBLISHED');
}

async function invalidateLiveRun(tx: Tx, periodId: string, reason: string) {
  await tx
    .update(t.distributionRuns)
    .set({ status: 'invalidated', invalidatedReason: reason })
    .where(and(eq(t.distributionRuns.periodId, periodId), notInArray(t.distributionRuns.status, ['published', 'invalidated'])));
}

/* -------------------------------- Matching -------------------------------- */

const aliasKeys = (l: { providerWorkCode: string | null; workTitle: string | null; writerIpi: string | null }) =>
  [l.providerWorkCode && `code:${l.providerWorkCode}`, l.workTitle && `title:${normalizeTitle(l.workTitle)}|ipi:${l.writerIpi ?? '-'}`].filter((x): x is string => !!x);

/**
 * Paso 3: código de obra del administrador → ISWC → alias aprendidos → IPI + título.
 * Lo que no casa va a la cola de revisión con sugerencias por similitud de título.
 */
export async function runMatching(deps: Deps, fileId: string) {
  const lines = await deps.db
    .select()
    .from(t.statementLines)
    .where(and(eq(t.statementLines.fileId, fileId), inArray(t.statementLines.matchStatus, ['unmatched', 'suggested', 'auto_matched'])));
  const works = await deps.db.select({ id: t.works.id, code: t.works.publisherWorkCode, iswc: t.works.iswc, title: t.works.title, createdBy: t.works.createdBy }).from(t.works).where(ne(t.works.status, 'draft'));
  const byCode = new Map(works.filter((w) => w.code).map((w) => [w.code!, w.id]));
  const byIswc = new Map(works.filter((w) => w.iswc).map((w) => [w.iswc!, w.id]));
  const aliases = new Map((await deps.db.select().from(t.workAliases).where(eq(t.workAliases.provider, PROVIDER))).map((a) => [a.aliasKey, a.workId]));
  const ipiWriters = await deps.db.select({ userId: t.writerProfiles.userId, ipi: t.writerProfiles.ipi }).from(t.writerProfiles).where(sql`${t.writerProfiles.ipi} is not null`);
  const writerByIpi = new Map(ipiWriters.map((w) => [w.ipi!, w.userId]));
  const memberWorks = await deps.db.execute<{ user_id: string; work_id: string; title: string }>(sql`
    select distinct ss.writer_user_id as user_id, w.id as work_id, w.title from works w
    join split_versions sv on sv.work_id = w.id join split_shares ss on ss.split_version_id = sv.id
    where ss.writer_user_id is not null and w.status <> 'draft'`);

  const counts = { auto: 0, suggested: 0, unmatched: 0 };
  await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'statement.match' }, async (tx) => {
    for (const l of lines) {
      let workId: string | undefined;
      let method: string | undefined;
      if (l.providerWorkCode && byCode.has(l.providerWorkCode)) [workId, method] = [byCode.get(l.providerWorkCode), 'publisher_code'];
      else if (l.iswc && byIswc.has(l.iswc)) [workId, method] = [byIswc.get(l.iswc), 'iswc'];
      else {
        const alias = aliasKeys(l).find((k) => aliases.has(k));
        if (alias) [workId, method] = [aliases.get(alias), 'alias'];
        else if (l.writerIpi && writerByIpi.has(l.writerIpi) && l.workTitle) {
          const uid = writerByIpi.get(l.writerIpi)!;
          const best = memberWorks.filter((m) => m.user_id === uid).map((m) => ({ id: m.work_id, sim: titleSimilarity(m.title, l.workTitle!) })).sort((a, b) => b.sim - a.sim)[0];
          if (best && best.sim >= 0.85) [workId, method] = [best.id, 'ipi_title'];
        }
      }
      if (workId) {
        await tx.update(t.statementLines).set({ matchStatus: 'auto_matched', matchedWorkId: workId, matchMethod: method, matchConfidence: '1.000' }).where(eq(t.statementLines.id, l.id));
        await tx.delete(t.matchSuggestions).where(eq(t.matchSuggestions.lineId, l.id));
        counts.auto++;
        continue;
      }
      const sugg = l.workTitle
        ? await tx.execute<{ id: string; score: number }>(sql`
            select id, extensions.similarity(title_normalized, ${normalizeTitle(l.workTitle)}) as score from works
            where status <> 'draft' and extensions.similarity(title_normalized, ${normalizeTitle(l.workTitle)}) > 0.3
            order by score desc limit 3`)
        : [];
      await tx.delete(t.matchSuggestions).where(eq(t.matchSuggestions.lineId, l.id));
      for (const s of sugg) await tx.insert(t.matchSuggestions).values({ lineId: l.id, workId: s.id, score: Number(s.score).toFixed(3) });
      await tx.update(t.statementLines).set({ matchStatus: sugg.length ? 'suggested' : 'unmatched', matchedWorkId: null, matchMethod: null, matchConfidence: null }).where(eq(t.statementLines.id, l.id));
      if (sugg.length) counts.suggested++;
      else counts.unmatched++;
    }
  });
  return counts;
}

/** Cola de revisión (E5). */
export async function matchingQueue(deps: Deps, periodId?: string) {
  const rows = await deps.db.execute<{ id: string; file_id: string; period: string; line_no: number; provider_work_code: string | null; work_title: string | null; writer_ipi: string | null; source: string; income_type: string; territory: string | null; currency: string; net: string; match_status: string }>(sql`
    select l.id, l.file_id, p.code as period, l.line_no, l.provider_work_code, l.work_title, l.writer_ipi, l.source, l.income_type, l.territory, l.currency, l.net, l.match_status
    from statement_lines l join statement_files f on f.id = l.file_id join statement_periods p on p.id = f.period_id
    where l.match_status in ('unmatched', 'suggested') and f.status <> 'superseded' ${periodId ? sql`and p.id = ${periodId}` : sql``}
      and not exists (select 1 from distribution_runs r where r.period_id = p.id and r.status = 'published')
    order by p.pay_date desc, l.line_no limit 500`);
  const ids = rows.map((r) => r.id);
  const suggestions = ids.length
    ? await deps.db.select({ lineId: t.matchSuggestions.lineId, workId: t.matchSuggestions.workId, score: t.matchSuggestions.score, title: t.works.title }).from(t.matchSuggestions).innerJoin(t.works, eq(t.works.id, t.matchSuggestions.workId)).where(inArray(t.matchSuggestions.lineId, ids))
    : [];
  return rows.map((r) => ({ ...r, suggestions: suggestions.filter((s) => s.lineId === r.id).sort((a, b) => Number(b.score) - Number(a.score)) }));
}

async function lineContext(deps: Deps, lineId: string) {
  const [l] = await deps.db.select().from(t.statementLines).where(eq(t.statementLines.id, lineId));
  if (!l) throw new DomainError('LINE_NOT_FOUND');
  const [f] = await deps.db.select().from(t.statementFiles).where(eq(t.statementFiles.id, l.fileId));
  await assertPeriodOpen(deps, f!.periodId);
  return { l, f: f! };
}

/** Match manual: también enseña un alias para que el próximo archivo case solo. */
export async function manualMatch(deps: Deps, staffId: string, lineId: string, workId: string, ctx: RequestCtx) {
  const role = await staff(deps, staffId, ['operator', 'super_admin']);
  const { l, f } = await lineContext(deps, lineId);
  const [w] = await deps.db.select({ id: t.works.id }).from(t.works).where(eq(t.works.id, workId));
  if (!w) throw new DomainError('WORK_NOT_FOUND');
  await withSystem(deps.db, ctxFor(staffId, role, 'statement.manual_match', ctx), async (tx) => {
    await tx.update(t.statementLines).set({ matchStatus: 'manual_matched', matchedWorkId: workId, matchMethod: 'manual', matchConfidence: '1.000', matchedBy: staffId }).where(eq(t.statementLines.id, lineId));
    for (const key of aliasKeys(l)) await tx.insert(t.workAliases).values({ provider: PROVIDER, aliasKey: key, workId, createdBy: staffId }).onConflictDoNothing();
    await invalidateLiveRun(tx, f.periodId, 'match manual');
  });
  await runMatching(deps, f.id);
}

export async function sendToSuspense(deps: Deps, staffId: string, lineId: string, ctx: RequestCtx) {
  const role = await staff(deps, staffId, ['operator', 'super_admin']);
  const { f } = await lineContext(deps, lineId);
  await withSystem(deps.db, ctxFor(staffId, role, 'statement.suspense', ctx), async (tx) => {
    await tx.update(t.statementLines).set({ matchStatus: 'suspense', matchedWorkId: null, matchMethod: 'manual', matchedBy: staffId }).where(eq(t.statementLines.id, lineId));
    await invalidateLiveRun(tx, f.periodId, 'línea a suspenso');
  });
}

export async function searchWorksForMatch(deps: Deps, q: string) {
  if (q.trim().length < 2) return [];
  return deps.db.execute<{ id: string; title: string; status: string; code: string | null }>(sql`
    select id, title, status, publisher_work_code as code from works
    where status <> 'draft' and (title ilike ${`%${q.trim()}%`} or publisher_work_code = ${q.trim()} or iswc = ${q.trim()})
    order by title limit 20`);
}

/* ---------------------------------- FX ------------------------------------ */

export async function setFxRate(deps: Deps, staffId: string, input: { base: string; rate: string; asOf: string; source: string }, ctx: RequestCtx) {
  const role = await staff(deps, staffId, ['operator', 'super_admin']);
  if (!/^[A-Z]{3}$/.test(input.base) || input.base === 'USD') throw new DomainError('CURRENCY_INVALID');
  if (!/^\d{1,6}(\.\d{1,10})?$/.test(input.rate) || Number(input.rate) <= 0) throw new DomainError('FX_RATE_INVALID');
  if (!input.source.trim()) throw new DomainError('FX_SOURCE_REQUIRED');
  await withSystem(deps.db, ctxFor(staffId, role, 'fx.set_rate', ctx), (tx) =>
    tx.insert(t.fxRates).values({ base: input.base, quote: 'USD', rate: input.rate, source: input.source.trim(), asOf: new Date(`${input.asOf}T00:00:00Z`).toISOString() }).onConflictDoNothing(),
  );
}

async function fxFor(deps: Deps, currency: string, payDate: string) {
  if (currency === 'USD') return { id: null, rate: '1' };
  const [r] = await deps.db
    .select()
    .from(t.fxRates)
    .where(and(eq(t.fxRates.base, currency), eq(t.fxRates.quote, 'USD'), sql`${t.fxRates.asOf} <= ${new Date(`${payDate}T23:59:59Z`).toISOString()}`))
    .orderBy(desc(t.fxRates.asOf))
    .limit(1);
  if (!r) throw new DomainError('FX_RATE_MISSING', { currency });
  return { id: r.id, rate: r.rate };
}

/* --------------------------- Cálculo y conciliación ----------------------- */

interface Snapshot {
  computedAt: string;
  payDate: string;
  fx: Record<string, { id: string | null; rate: string }>;
  writers: Record<string, { plan: PlanCode; commissionBps: number; residence: string }>;
  withholdingRules: { id: string; country: string; incomeType: string | null; rateBps: number }[];
  lineVersions: Record<string, { workId: string; versionId: string | null; held: boolean }>;
}

/** Pasos 4–6: distribución con el split vigente, comisión por plan, retenciones y FX; conciliación al centavo. */
export async function calculateRun(deps: Deps, staffId: string, periodId: string, receivedAmountUsd: string, ctx: RequestCtx) {
  const role = await staff(deps, staffId, ['operator', 'super_admin']);
  const received = parseMoneyInput(receivedAmountUsd);
  if (received === null) throw new DomainError('RECEIVED_AMOUNT_INVALID');
  await assertPeriodOpen(deps, periodId);
  const [period] = await deps.db.select().from(t.statementPeriods).where(eq(t.statementPeriods.id, periodId));
  if (!period) throw new DomainError('PERIOD_NOT_FOUND');
  const files = await deps.db.select().from(t.statementFiles).where(and(eq(t.statementFiles.periodId, periodId), ne(t.statementFiles.status, 'superseded')));
  if (!files.length) throw new DomainError('NO_FILES');
  const lines = await deps.db.select().from(t.statementLines).where(inArray(t.statementLines.fileId, files.map((f) => f.id))).orderBy(asc(t.statementLines.fileId), asc(t.statementLines.lineNo));

  // FX documentado por moneda
  const fx: Snapshot['fx'] = {};
  for (const ccy of new Set([...lines.map((l) => l.currency), ...files.flatMap((f) => Object.keys(f.controlTotals as Record<string, string>))])) fx[ccy] = await fxFor(deps, ccy, period.payDate);

  // Obras, versiones firmadas y participaciones
  const workIds = [...new Set(lines.map((l) => l.matchedWorkId).filter((x): x is string => !!x))];
  const works = workIds.length ? await deps.db.select({ id: t.works.id, status: t.works.status }).from(t.works).where(inArray(t.works.id, workIds)) : [];
  const versions = workIds.length ? await deps.db.select().from(t.splitVersions).where(and(inArray(t.splitVersions.workId, workIds), inArray(t.splitVersions.status, ['signed', 'superseded']))) : [];
  const shares = versions.length ? await deps.db.select().from(t.splitShares).where(inArray(t.splitShares.splitVersionId, versions.map((v) => v.id))) : [];

  // Términos por autor: comisión del plan vigente y país de residencia fiscal
  const writerIds = [...new Set(shares.filter((s) => s.administered && s.writerUserId).map((s) => s.writerUserId!))];
  const periods = writerIds.length ? await deps.db.select().from(t.membershipPlanPeriods).where(inArray(t.membershipPlanPeriods.userId, writerIds)) : [];
  const profiles = writerIds.length ? await deps.db.select({ userId: t.writerProfiles.userId, country: t.writerProfiles.country }).from(t.writerProfiles).where(inArray(t.writerProfiles.userId, writerIds)) : [];
  const taxes = writerIds.length ? await deps.db.select({ userId: t.taxProfiles.userId, country: t.taxProfiles.taxCountry }).from(t.taxProfiles).where(inArray(t.taxProfiles.userId, writerIds)) : [];
  const now = deps.now();
  const writers: Snapshot['writers'] = {};
  for (const id of writerIds) {
    const c = commissionAt(periods.filter((p) => p.userId === id).map((p) => ({ plan: p.planCode, commissionBps: p.commissionBps, validFrom: new Date(p.validFrom), validTo: p.validTo ? new Date(p.validTo) : null })), now);
    writers[id] = { ...c, residence: taxes.find((x) => x.userId === id)?.country ?? profiles.find((x) => x.userId === id)?.country ?? 'XX' };
  }
  const today = now.toISOString().slice(0, 10);
  const rules = (await deps.db.select().from(t.taxWithholdingRules).where(and(sql`${t.taxWithholdingRules.validFrom} <= ${today}`, sql`(${t.taxWithholdingRules.validTo} is null or ${t.taxWithholdingRules.validTo} > ${today})`))).map((r) => ({ id: r.id, country: r.residenceCountry, incomeType: r.incomeType, rateBps: r.rateBps }));
  const withholdingBps = (country: string, incomeType: string) => (rules.find((r) => r.country === country && r.incomeType === incomeType) ?? rules.find((r) => r.country === country && r.incomeType === null))?.rateBps ?? 0;

  // Distribución línea por línea
  const lineVersions: Snapshot['lineVersions'] = {};
  const rows: (DistributionRow & { fxRateId: string | null })[] = [];
  let parsedTotalUsd = dec(0);
  for (const l of lines) {
    const rate = fx[l.currency]!;
    parsedTotalUsd = parsedTotalUsd.plus(dec(l.net).times(rate.rate));
    const matched = ['auto_matched', 'manual_matched'].includes(l.matchStatus) ? l.matchedWorkId : null;
    let lineShares = null;
    let held = false;
    if (matched) {
      const v = applicableVersion(versions.filter((x) => x.workId === matched), l.exploitationEnd);
      held = works.find((w) => w.id === matched)?.status === 'disputed';
      lineVersions[l.id] = { workId: matched, versionId: v?.id ?? null, held };
      lineShares = v ? shares.filter((s) => s.splitVersionId === v.id).map((s) => ({ shareId: s.id, writerUserId: s.writerUserId, bps: s.shareBps, administered: s.administered })) : [];
    }
    const terms = (id: string): WriterTerms => ({ commissionBps: writers[id]!.commissionBps, withholdingBps: withholdingBps(writers[id]!.residence, l.incomeType) });
    for (const r of distributeLine({ lineId: l.id, net: l.net, currency: l.currency, fxRate: rate.rate, shares: lineShares, held }, terms)) rows.push({ ...r, fxRateId: rate.id });
  }
  const controlTotalUsd = files.reduce((acc, f) => Object.entries(f.controlTotals as Record<string, string>).reduce((a, [ccy, v]) => a.plus(dec(v).times(fx[ccy]!.rate)), acc), dec(0));
  const receivedCents = dec(received).times(100).toNumber();
  const rec = reconcile({ rows, receivedCents, controlTotalUsd: controlTotalUsd.toFixed(6), parsedTotalUsd: parsedTotalUsd.toFixed(6) });

  const snapshot: Snapshot = { computedAt: now.toISOString(), payDate: period.payDate, fx, writers, withholdingRules: rules, lineVersions };
  const snapshotJson = JSON.stringify(snapshot);
  const runId = await withSystem(deps.db, ctxFor(staffId, role, 'statement.calculate', ctx), async (tx) => {
    await invalidateLiveRun(tx, periodId, 'recálculo');
    const [run] = await tx
      .insert(t.distributionRuns)
      .values({ periodId, fileIds: files.map((f) => f.id), status: rec.balanced ? 'reconciled' : 'unbalanced', paramsSnapshot: snapshot, paramsSha256: sha256(snapshotJson), calculatedBy: staffId, calculatedAt: now.toISOString(), receivedCents })
      .returning({ id: t.distributionRuns.id });
    const values = rows.map((r) => ({
      runId: run!.id,
      lineId: r.lineId,
      splitShareId: r.shareId,
      writerUserId: r.writerUserId,
      shareBps: r.shareBps,
      status: r.status,
      gross: r.gross.toFixed(6),
      fxRateId: r.fxRateId,
      grossPayoutCcy: r.grossUsd.toFixed(6),
      commissionBps: r.commissionBps,
      commission: r.commission.toFixed(6),
      withholdingBps: r.withholdingBps,
      withholding: r.withholding.toFixed(6),
      recoupment: '0',
      net: r.net.toFixed(6),
      holdReason: r.suspenseReason ?? (r.status === 'held_dispute' ? 'dispute' : null),
    }));
    for (let i = 0; i < values.length; i += 500) await tx.insert(t.distributions).values(values.slice(i, i + 500));
    await tx.insert(t.reconciliations).values({
      runId: run!.id,
      currency: 'USD',
      receivedCents: rec.receivedCents,
      controlTotalCents: rec.controlTotalCents,
      parsedTotalCents: rec.parsedTotalCents,
      writersNetCents: rec.writersNetCents,
      commissionCents: rec.commissionCents,
      withholdingCents: rec.withholdingCents,
      recoupmentCents: rec.recoupmentCents,
      heldCents: rec.heldCents,
      suspenseCents: rec.suspenseCents,
      roundingCents: rec.roundingCents,
    });
    return run!.id;
  });
  return { runId, reconciliation: rec, unresolvedLines: lines.filter((l) => ['unmatched', 'suggested'].includes(l.matchStatus)).length };
}

export async function getRun(deps: Deps, runId: string) {
  const [run] = await deps.db.select().from(t.distributionRuns).where(eq(t.distributionRuns.id, runId));
  if (!run) return null;
  const [rec] = await deps.db.select().from(t.reconciliations).where(eq(t.reconciliations.runId, runId));
  const writers = await writerTotalsForRun(deps, runId);
  return { run, reconciliation: rec ?? null, writers };
}

/** Totales por autor en centavos, con el mismo reparto por mayor residuo de la conciliación. */
async function writerTotalsForRun(deps: Deps, runId: string) {
  const rows = await deps.db.select().from(t.distributions).where(eq(t.distributions.runId, runId));
  const [run] = await deps.db.select().from(t.distributionRuns).where(eq(t.distributionRuns.id, runId));
  const rec = reconcile({
    rows: rows.map((r) => ({ lineId: r.lineId, shareId: r.splitShareId, writerUserId: r.writerUserId, shareBps: r.shareBps, status: r.status, suspenseReason: null, gross: dec(r.gross), grossUsd: dec(r.grossPayoutCcy), commissionBps: r.commissionBps, commission: dec(r.commission), withholdingBps: r.withholdingBps, withholding: dec(r.withholding), net: dec(r.net) })),
    receivedCents: Number(run!.receivedCents ?? 0),
    controlTotalUsd: '0',
    parsedTotalUsd: '0',
  });
  return rec.writers;
}

/* ------------------------- Aprobación y publicación ------------------------ */

/** Paso 7a: aprueba una persona distinta a quien calculó (también lo exige la base de datos). */
export async function approveRun(deps: Deps, staffId: string, runId: string, ctx: RequestCtx) {
  const role = await staff(deps, staffId, ['approver', 'super_admin']);
  await withSystem(deps.db, ctxFor(staffId, role, 'statement.approve', ctx), async (tx) => {
    const [run] = await tx.select().from(t.distributionRuns).where(eq(t.distributionRuns.id, runId)).for('update');
    if (!run) throw new DomainError('RUN_NOT_FOUND');
    if (run.status !== 'reconciled') throw new DomainError(run.status === 'unbalanced' ? 'RUN_UNBALANCED' : 'RUN_NOT_RECONCILED');
    if (run.calculatedBy === staffId) throw new DomainError('APPROVER_MUST_DIFFER');
    await tx.update(t.distributionRuns).set({ status: 'approved', approvedBy: staffId, approvedAt: deps.now().toISOString() }).where(eq(t.distributionRuns.id, runId));
  });
}

/** Autores que reciben statement: los del cálculo y los socios con obras administradas sin ingresos (saldo cero). */
async function recipients(deps: Deps, runId: string) {
  const totals = await writerTotalsForRun(deps, runId);
  const zero = await deps.db.execute<{ user_id: string }>(sql`
    select distinct ss.writer_user_id as user_id from split_shares ss
    join split_versions sv on sv.id = ss.split_version_id and sv.status = 'signed'
    join memberships m on m.user_id = ss.writer_user_id
    where ss.administered and ss.writer_user_id is not null`);
  const ids = new Set(totals.map((w) => w.writerUserId));
  const zeroIds = zero.map((z) => z.user_id).filter((id) => !ids.has(id));
  return { totals, zeroIds };
}

export async function publicationPreview(deps: Deps, runId: string) {
  const { totals, zeroIds } = await recipients(deps, runId);
  return {
    writers: totals.length + zeroIds.length,
    zeroBalance: zeroIds.length + totals.filter((w) => w.netCents === 0 && w.heldCents === 0).length,
    negative: totals.filter((w) => w.netCents < 0).length,
    netTotalCents: totals.reduce((a, w) => a + w.netCents, 0),
  };
}

/** Programa la publicación para una hora (el worker la ejecuta) o publica ya. */
export async function schedulePublication(deps: Deps, staffId: string, runId: string, at: Date, ctx: RequestCtx) {
  const role = await staff(deps, staffId, ['operator', 'approver', 'super_admin']);
  await withSystem(deps.db, ctxFor(staffId, role, 'statement.schedule', ctx), async (tx) => {
    const [run] = await tx.select().from(t.distributionRuns).where(eq(t.distributionRuns.id, runId));
    if (run?.status !== 'approved' && run?.status !== 'scheduled') throw new DomainError('RUN_NOT_APPROVED');
    await tx.update(t.distributionRuns).set({ status: 'scheduled', scheduledFor: at.toISOString() }).where(eq(t.distributionRuns.id, runId));
  });
}

export async function publishDueRuns(deps: Deps) {
  const due = await deps.db.select().from(t.distributionRuns).where(and(eq(t.distributionRuns.status, 'scheduled'), sql`${t.distributionRuns.scheduledFor} <= ${deps.now().toISOString()}`));
  for (const r of due) await publishRun(deps, null, r.id, { ip: null, userAgent: 'worker' });
  return due.length;
}

/**
 * Paso 7b: publicación. Solo con conciliación cuadrada y aprobación de otra persona. Crea un
 * statement por autor y período (único: nunca dos veces), acredita el ledger y emite
 * statement.published (PDF + correo en el idioma de cada autor).
 */
export async function publishRun(deps: Deps, staffId: string | null, runId: string, ctx: RequestCtx) {
  const role = staffId ? await staff(deps, staffId, ['operator', 'approver', 'super_admin']) : 'system';
  const [run] = await deps.db.select().from(t.distributionRuns).where(eq(t.distributionRuns.id, runId));
  if (!run) throw new DomainError('RUN_NOT_FOUND');
  if (run.status === 'published') return { published: 0 };
  if (run.status !== 'approved' && run.status !== 'scheduled') throw new DomainError('RUN_NOT_APPROVED');
  const [rec] = await deps.db.select().from(t.reconciliations).where(eq(t.reconciliations.runId, runId));
  if (!rec?.balanced) throw new DomainError('RUN_UNBALANCED');

  // La comisión es la del plan vigente en la fecha de publicación: si cambió, hay que recalcular.
  const snapshot = run.paramsSnapshot as Snapshot;
  const now = deps.now();
  const ids = Object.keys(snapshot.writers);
  const periods = ids.length ? await deps.db.select().from(t.membershipPlanPeriods).where(inArray(t.membershipPlanPeriods.userId, ids)) : [];
  for (const id of ids) {
    const c = commissionAt(periods.filter((p) => p.userId === id).map((p) => ({ plan: p.planCode, commissionBps: p.commissionBps, validFrom: new Date(p.validFrom), validTo: p.validTo ? new Date(p.validTo) : null })), now);
    if (c.commissionBps !== snapshot.writers[id]!.commissionBps) {
      await withSystem(deps.db, { actorId: staffId, actorRole: role as 'operator', command: 'statement.invalidate', ...ctx }, (tx) =>
        tx.update(t.distributionRuns).set({ status: 'invalidated', invalidatedReason: 'cambio de plan antes de publicar' }).where(eq(t.distributionRuns.id, runId)),
      );
      throw new DomainError('RUN_STALE_PLAN_CHANGED');
    }
  }

  const { totals, zeroIds } = await recipients(deps, runId);
  const adjustments = await deps.db.execute<{ writer_user_id: string; net: string }>(sql`
    select d.writer_user_id, sum(d.net)::text as net from distributions d join statement_lines l on l.id = d.line_id
    where d.run_id = ${runId} and d.status = 'payable' and l.is_adjustment and d.writer_user_id is not null group by d.writer_user_id`);
  const topWorks = await deps.db.execute<{ writer_user_id: string; work_id: string }>(sql`
    select distinct on (d.writer_user_id) d.writer_user_id, l.matched_work_id as work_id
    from distributions d join statement_lines l on l.id = d.line_id
    where d.run_id = ${runId} and d.writer_user_id is not null and l.matched_work_id is not null
    group by d.writer_user_id, l.matched_work_id order by d.writer_user_id, sum(d.net) desc`);

  let published = 0;
  await withSystem(deps.db, { actorId: staffId, actorRole: role as 'operator', command: 'statement.publish', ...ctx }, async (tx) => {
    const [locked] = await tx.select().from(t.distributionRuns).where(eq(t.distributionRuns.id, runId)).for('update');
    if (locked!.status === 'published') return;
    const all = [...totals, ...zeroIds.map((id) => ({ writerUserId: id, netCents: 0, commissionCents: 0, withholdingCents: 0, heldCents: 0, grossCents: 0 }))];
    for (const w of all) {
      const [{ bal }] = (await tx.execute<{ bal: string }>(sql`select coalesce(sum(amount_cents), 0)::text as bal from writer_ledger_entries where writer_user_id = ${w.writerUserId} and currency = 'USD'`)) as unknown as [{ bal: string }];
      const opening = Number(bal);
      const terms = snapshot.writers[w.writerUserId];
      const plan = terms ?? { plan: 'socio' as PlanCode, commissionBps: 0 };
      const adj = adjustments.find((a) => a.writer_user_id === w.writerUserId);
      const [ws] = await tx
        .insert(t.writerStatements)
        .values({
          runId,
          periodId: run.periodId,
          writerUserId: w.writerUserId,
          currency: 'USD',
          planCodeApplied: plan.plan,
          commissionBpsApplied: plan.commissionBps,
          openingBalanceCents: opening,
          grossCents: w.grossCents,
          commissionCents: w.commissionCents,
          withholdingCents: w.withholdingCents,
          recoupmentCents: 0,
          adjustmentsCents: adj ? dec(adj.net).times(100).toDecimalPlaces(0, D.ROUND_HALF_UP).toNumber() : 0,
          heldCents: w.heldCents,
          netCents: w.netCents,
          closingBalanceCents: opening + w.netCents,
          topWorkId: topWorks.find((x) => x.writer_user_id === w.writerUserId)?.work_id ?? null,
          publishedAt: now.toISOString(),
        })
        .onConflictDoNothing()
        .returning({ id: t.writerStatements.id });
      if (!ws) continue; // ya existía: idempotente
      if (w.netCents !== 0) await tx.insert(t.writerLedgerEntries).values({ writerUserId: w.writerUserId, type: 'statement_credit', amountCents: w.netCents, currency: 'USD', writerStatementId: ws.id, memo: `statement ${run.periodId}` });
      await emit(tx, 'statement.published', 'writer_statement', ws.id, { periodId: run.periodId });
      published++;
    }
    await tx.update(t.distributionRuns).set({ status: 'published', publishedBy: staffId, publishedAt: now.toISOString() }).where(eq(t.distributionRuns.id, runId));
    await detectUnclaimed(tx, run.periodId);
  });
  return { published };
}

/**
 * Regalías sin reclamar: líneas del período que quedaron sin asignar (suspenso o sin match) pero cuyo
 * IPI de autor es el de un autor de Pluma. Un aviso por autor y período (la clave de la notificación lo garantiza).
 */
export async function detectUnclaimed(tx: Tx, periodId: string) {
  const rows = await tx.execute<{ user_id: string; count: number; titles: string[] }>(sql`
    select wp.user_id, count(*)::int as count, array_agg(distinct coalesce(l.work_title, '—')) as titles
    from statement_lines l join statement_files f on f.id = l.file_id
    join writer_profiles wp on wp.ipi is not null and wp.ipi = l.writer_ipi
    where f.period_id = ${periodId} and f.status <> 'superseded' and l.match_status in ('unmatched', 'suggested', 'suspense')
    group by wp.user_id`);
  for (const r of rows) await emit(tx, 'royalties.unclaimed_detected', 'user', r.user_id, { periodId, count: r.count, titles: r.titles.sort() });
  return rows.length;
}

/* ------------------------------ Vista del autor ---------------------------- */

const centsOf = (v: string) => dec(v).times(100).toDecimalPlaces(0, D.ROUND_HALF_UP).toNumber();

/** Modelo único del statement (dashboard y PDF). */
export async function statementView(deps: Deps, writerStatementId: string) {
  const [s] = await deps.db.select().from(t.writerStatements).where(eq(t.writerStatements.id, writerStatementId));
  if (!s) return null;
  const [period] = await deps.db.select().from(t.statementPeriods).where(eq(t.statementPeriods.id, s.periodId));
  const [u] = await deps.db
    .select({ locale: t.users.locale, legalName: t.writerProfiles.legalName, artistName: t.writerProfiles.artistName, country: t.writerProfiles.country, society: t.writerProfiles.societyCode, ipi: t.writerProfiles.ipi })
    .from(t.users)
    .innerJoin(t.writerProfiles, eq(t.writerProfiles.userId, t.users.id))
    .where(eq(t.users.id, s.writerUserId));
  const rows = await deps.db.execute<{ title: string | null; work_id: string | null; share_bps: number; status: string; gross: string; net: string; income_type: string; source: string; territory: string | null }>(sql`
    select w.title, w.id as work_id, d.share_bps, d.status, d.gross_payout_ccy as gross, d.net, l.income_type, l.source, l.territory
    from distributions d join statement_lines l on l.id = d.line_id left join works w on w.id = l.matched_work_id
    where d.run_id = ${s.runId} and d.writer_user_id = ${s.writerUserId}`);
  const group = (key: (r: (typeof rows)[number]) => string, payableOnly = true) => {
    const m = new Map<string, ReturnType<typeof dec>>();
    for (const r of rows) {
      if (payableOnly && r.status !== 'payable') continue;
      const k = key(r);
      m.set(k, (m.get(k) ?? dec(0)).plus(r.net));
    }
    return [...m.entries()].map(([k, v]) => ({ key: k, netCents: v.times(100).toDecimalPlaces(0, D.ROUND_HALF_UP).toNumber() })).sort((a, b) => b.netCents - a.netCents);
  };
  const works = new Map<string, { title: string; shareBps: number; gross: ReturnType<typeof dec>; net: ReturnType<typeof dec>; held: boolean }>();
  for (const r of rows) {
    const k = r.work_id ?? '-';
    const w = works.get(k) ?? { title: r.title ?? '—', shareBps: r.share_bps, gross: dec(0), net: dec(0), held: false };
    w.gross = w.gross.plus(r.gross);
    if (r.status === 'payable') w.net = w.net.plus(r.net);
    w.held = w.held || r.status === 'held_dispute';
    works.set(k, w);
  }
  const locale = (u?.locale ?? 'es') as 'es' | 'en' | 'pt-BR';
  const { intlLocale } = await import('./format');
  return {
    statementId: s.id,
    writerUserId: s.writerUserId,
    periodId: s.periodId,
    periodCode: period!.code,
    payDate: period!.payDate,
    publishedAt: s.publishedAt,
    locale,
    intlLocale: intlLocale(locale, u?.country),
    currency: s.currency,
    writer: { legalName: u?.legalName ?? '', artistName: u?.artistName ?? null, country: u?.country ?? '', society: u?.society ?? null, ipi: u?.ipi ?? null },
    plan: { code: s.planCodeApplied, commissionBps: s.commissionBpsApplied },
    totals: { openingCents: Number(s.openingBalanceCents), grossCents: Number(s.grossCents), commissionCents: Number(s.commissionCents), withholdingCents: Number(s.withholdingCents), heldCents: Number(s.heldCents), netCents: Number(s.netCents), adjustmentsCents: Number(s.adjustmentsCents), closingCents: Number(s.closingBalanceCents) },
    byWork: [...works.values()].map((w) => ({ title: w.title, shareBps: w.shareBps, grossCents: centsOf(w.gross.toFixed(6)), netCents: centsOf(w.net.toFixed(6)), held: w.held })).sort((a, b) => b.netCents - a.netCents),
    byIncomeType: group((r) => r.income_type),
    bySource: group((r) => r.source),
    byTerritory: group((r) => r.territory ?? '—'),
    topWorkId: s.topWorkId,
    pdfPath: s.pdfPath,
    pdfSha256: s.pdfSha256,
    csvPath: s.csvPath,
  };
}
export type WriterStatementView = NonNullable<Awaited<ReturnType<typeof statementView>>>;

/** Lista de statements del autor (A14), leída con RLS: solo los publicados y propios. */
export async function listMyStatements(deps: Deps, userId: string) {
  return withUser(deps.db, userId, (tx) =>
    tx
      .select({ id: t.writerStatements.id, periodId: t.writerStatements.periodId, code: t.statementPeriods.code, payDate: t.statementPeriods.payDate, netCents: t.writerStatements.netCents, heldCents: t.writerStatements.heldCents, closingCents: t.writerStatements.closingBalanceCents, publishedAt: t.writerStatements.publishedAt })
      .from(t.writerStatements)
      .innerJoin(t.statementPeriods, eq(t.statementPeriods.id, t.writerStatements.periodId))
      .orderBy(desc(t.statementPeriods.payDate)),
  );
}

/** Statement del autor (A15): RLS autoriza, luego se arma la vista completa. */
export async function getMyStatement(deps: Deps, userId: string, statementId: string) {
  const ok = await withUser(deps.db, userId, (tx) => tx.select({ id: t.writerStatements.id }).from(t.writerStatements).where(eq(t.writerStatements.id, statementId)));
  return ok.length ? statementView(deps, statementId) : null;
}

/** CSV del statement: una fila por distribución, reproducible desde la base. */
export async function statementCsv(deps: Deps, writerStatementId: string) {
  const [s] = await deps.db.select().from(t.writerStatements).where(eq(t.writerStatements.id, writerStatementId));
  if (!s) return null;
  const rows = await deps.db.execute<Record<string, string | number | null>>(sql`
    select coalesce(w.title, l.work_title) as work, l.source, l.income_type, l.territory, l.exploitation_start, l.exploitation_end, l.currency,
      l.net as line_net, d.share_bps, d.status, d.gross_payout_ccy as gross_usd, d.commission, d.withholding, d.net as net_usd, l.adjusts_period
    from distributions d join statement_lines l on l.id = d.line_id left join works w on w.id = l.matched_work_id
    where d.run_id = ${s.runId} and d.writer_user_id = ${s.writerUserId} order by work, l.line_no`);
  const head = ['work', 'source', 'income_type', 'territory', 'exploitation_start', 'exploitation_end', 'currency', 'line_net', 'share_pct', 'status', 'gross_usd', 'commission_usd', 'withholding_usd', 'net_usd', 'adjusts_period'];
  const cell = (v: unknown) => {
    const x = String(v ?? '');
    return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
  };
  return [head.join(','), ...rows.map((r) => [r.work, r.source, r.income_type, r.territory, r.exploitation_start, r.exploitation_end, r.currency, r.line_net, (Number(r.share_bps) / 100).toFixed(2), r.status, r.gross_usd, r.commission, r.withholding, r.net_usd, r.adjusts_period].map(cell).join(','))].join('\n') + '\n';
}

/** Genera y guarda (una sola vez) el PDF y el CSV del statement. */
export async function renderStatementFiles(deps: Deps, writerStatementId: string) {
  const view = await statementView(deps, writerStatementId);
  if (!view || view.pdfPath) return view;
  const { renderStatementPdf } = await import('@pluma/pdf');
  const pdf = await renderStatementPdf(view);
  const csv = Buffer.from((await statementCsv(deps, writerStatementId))!);
  const base = `statements/${view.periodCode}/${view.writerUserId}`;
  const pdfPath = `${base}/${writerStatementId}.pdf`;
  const csvPath = `${base}/${writerStatementId}.csv`;
  for (const [p, b, ct] of [[pdfPath, pdf, 'application/pdf'], [csvPath, csv, 'text/csv']] as const) {
    await deps.storage.putOnce('documents', p, b, ct).catch((e: Error) => {
      if (e.message !== 'OBJECT_EXISTS') throw e;
    });
  }
  await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'statement.render' }, (tx) =>
    tx.update(t.writerStatements).set({ pdfPath: `documents/${pdfPath}`, pdfSha256: sha256(pdf), csvPath: `documents/${csvPath}` }).where(and(eq(t.writerStatements.id, writerStatementId), isNull(t.writerStatements.pdfPath))),
  );
  return statementView(deps, writerStatementId);
}

/** Envío de prueba del correo de un statement al operador (vista previa). */
export async function sendTestStatementEmail(deps: Deps, staffId: string, runId: string) {
  await staff(deps, staffId, ['operator', 'approver', 'super_admin']);
  const { totals } = await recipients(deps, runId);
  const w = totals.sort((a, b) => b.netCents - a.netCents)[0];
  const [me] = await deps.db.select().from(t.users).where(eq(t.users.id, staffId));
  const [run] = await deps.db.select().from(t.distributionRuns).where(eq(t.distributionRuns.id, runId));
  const [period] = await deps.db.select().from(t.statementPeriods).where(eq(t.statementPeriods.id, run!.periodId));
  const { renderEmail } = await import('@pluma/emails');
  const { formatMoney } = await import('./format');
  const email = renderEmail('statement_published', 'es', { period: period!.code, net: formatMoney(w?.netCents ?? 0, 'USD', 'es'), topWork: '—', highlights: `Envío de prueba · ${totals.length} autores`, statementUrl: `${deps.appUrl}/pagos` });
  await deps.mail.send({ to: me!.email, ...email, subject: `[PRUEBA] ${email.subject}`, tag: 'statement_test', idempotencyKey: `statement.test:${runId}:${Date.now()}` });
  await withSystem(deps.db, { actorId: staffId, actorRole: 'operator', command: 'statement.test_email' }, (tx) => tx.update(t.distributionRuns).set({ testSentAt: deps.now().toISOString() }).where(eq(t.distributionRuns.id, runId)));
}

export async function periodDetail(deps: Deps, periodId: string) {
  const [period] = await deps.db.select().from(t.statementPeriods).where(eq(t.statementPeriods.id, periodId));
  if (!period) return null;
  const files = await deps.db.select().from(t.statementFiles).where(eq(t.statementFiles.periodId, periodId)).orderBy(desc(t.statementFiles.version));
  const lineStats = await deps.db.execute<{ match_status: string; n: number }>(sql`
    select l.match_status, count(*)::int as n from statement_lines l join statement_files f on f.id = l.file_id
    where f.period_id = ${periodId} and f.status <> 'superseded' group by l.match_status`);
  const [run] = await deps.db.select().from(t.distributionRuns).where(and(eq(t.distributionRuns.periodId, periodId), ne(t.distributionRuns.status, 'invalidated'))).orderBy(desc(t.distributionRuns.calculatedAt)).limit(1);
  const currencies = await deps.db.execute<{ currency: string }>(sql`select distinct l.currency from statement_lines l join statement_files f on f.id = l.file_id where f.period_id = ${periodId} and l.currency <> 'USD'`);
  const rates = currencies.length ? await deps.db.select().from(t.fxRates).where(inArray(t.fxRates.base, currencies.map((c) => c.currency))).orderBy(desc(t.fxRates.asOf)) : [];
  return { period, files, lineStats, run: run ?? null, currencies: currencies.map((c) => c.currency), rates };
}

/* ------------------------- Analítica y alertas (A19–A20) ------------------------- */

/** Ingresos netos por obra y período (solo statements publicados del autor). */
export async function writerIncomeByWork(deps: Deps, userId: string) {
  return deps.db.execute<{ period: string; pay_date: string; work_id: string | null; title: string; net: string; territories: string[] }>(sql`
    select p.code as period, p.pay_date, w.id as work_id, coalesce(w.title, '—') as title, sum(d.net)::text as net,
      array_agg(distinct l.territory) filter (where l.territory is not null) as territories
    from writer_statements s
    join statement_periods p on p.id = s.period_id
    join distributions d on d.run_id = s.run_id and d.writer_user_id = s.writer_user_id and d.status = 'payable'
    join statement_lines l on l.id = d.line_id
    left join works w on w.id = l.matched_work_id
    where s.writer_user_id = ${userId} and s.published_at is not null
    group by p.code, p.pay_date, w.id, w.title
    order by p.pay_date, title`);
}

export interface WriterAlert {
  kind: 'no_income' | 'new_territory';
  title?: string;
  territory?: string;
}

/** Alertas: obras administradas sin ingresos en los dos últimos períodos e ingresos en territorios nuevos. */
export async function writerAlerts(deps: Deps, userId: string): Promise<WriterAlert[]> {
  const periods = await deps.db.execute<{ id: string; run_id: string }>(sql`
    select s.period_id as id, s.run_id from writer_statements s join statement_periods p on p.id = s.period_id
    where s.writer_user_id = ${userId} and s.published_at is not null order by p.pay_date desc limit 2`);
  if (!periods.length) return [];
  const alerts: WriterAlert[] = [];
  if (periods.length === 2) {
    const quiet = await deps.db.execute<{ title: string }>(sql`
      select distinct w.title from works w
      join split_versions sv on sv.work_id = w.id and sv.status = 'signed'
      join split_shares ss on ss.split_version_id = sv.id and ss.writer_user_id = ${userId} and ss.administered
      where w.status in ('registered', 'sent_to_publisher')
        and not exists (select 1 from distributions d join statement_lines l on l.id = d.line_id
                        where d.writer_user_id = ${userId} and l.matched_work_id = w.id and d.run_id in (${periods[0]!.run_id}, ${periods[1]!.run_id}))`);
    for (const q of quiet) alerts.push({ kind: 'no_income', title: q.title });
  }
  const fresh = await deps.db.execute<{ territory: string }>(sql`
    select distinct l.territory from distributions d join statement_lines l on l.id = d.line_id
    where d.run_id = ${periods[0]!.run_id} and d.writer_user_id = ${userId} and l.territory is not null
      and not exists (select 1 from distributions d2 join statement_lines l2 on l2.id = d2.line_id join writer_statements s2 on s2.run_id = d2.run_id and s2.writer_user_id = d2.writer_user_id
                      where d2.writer_user_id = ${userId} and l2.territory = l.territory and d2.run_id <> ${periods[0]!.run_id} and s2.published_at is not null)`);
  // Un territorio solo es "nuevo" si hay historia con qué comparar.
  if (periods.length === 2) {
    for (const f of fresh) alerts.push({ kind: 'new_territory', territory: f.territory });
  }
  return alerts;
}
