import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql, t } from '@pluma/db';
import { makeHarness } from './harness';
import { signedWork } from './world';

const h = makeHarness();
const { S, deps, ctx } = h;
afterAll(() => h.close());

const fixture = (n: string) => readFileSync(join(__dirname, '../../../fixtures/statements', n));
const W: Record<string, string> = {};
let ops = '';
let appr = '';

beforeAll(async () => {
  const vale = await h.onboardWriter({ plan: 'pro', name: 'Valentina Ríos' });
  const diego = await h.onboardWriter({ plan: 'socio', name: 'Diego Morales', locale: 'es' });
  const sam = await h.onboardWriter({ plan: 'pro', name: 'Samantha Rivera', locale: 'en' });
  W.vale = vale.id; W.diego = diego.id; W.sam = sam.id;
  await S.saveSociety(deps, diego.id, { societyCode: 'SACM', societyOther: null, ipi: '00712345679' }, ctx);
  const o = await h.onboardWriter({ name: 'Operadora' });
  const a = await h.onboardWriter({ name: 'Aprobador' });
  ops = o.id; appr = a.id;
  await deps.db.insert(t.userRoles).values([{ userId: ops, role: 'operator' }, { userId: appr, role: 'approver' }]);

  W.luna = await signedWork(h, vale.id, 'Luna de Medellín', [
    { kind: 'member', userId: vale.id, role: 'composer_lyricist', bps: 4000 },
    { kind: 'member', userId: diego.id, role: 'composer', bps: 3000 },
    { kind: 'external', name: 'Andrés Cano', email: 'andres@ext.test', role: 'lyricist', bps: 1500 },
    { kind: 'external', name: 'Lina Zapata', email: 'lina@ext.test', role: 'arranger', bps: 1500 },
  ], { code: 'PLM-CO-000101', iswc: 'T-034.524.680-1', opsId: ops });
  W.cumbia = await signedWork(h, vale.id, 'Cumbia del Río Grande', [{ kind: 'member', userId: vale.id, role: 'composer_lyricist', bps: 10000 }], { code: 'PLM-CO-000102', opsId: ops });
  W.midnight = await signedWork(h, sam.id, 'Midnight in Wynwood', [
    { kind: 'member', userId: sam.id, role: 'composer_lyricist', bps: 5000 },
    { kind: 'member', userId: vale.id, role: 'lyricist', bps: 2500 },
    { kind: 'external', name: 'Marcus Lee', email: 'marcus@ext.test', role: 'composer', bps: 2500 },
  ], { code: 'PLM-US-000201', iswc: 'T-123.456.789-4', opsId: ops });
  // Corrido: firmado y luego en disputa por reclamo de una nueva versión
  W.corrido = await signedWork(h, diego.id, 'Corrido del Desvelo', [
    { kind: 'member', userId: diego.id, role: 'composer', bps: 6000 },
    { kind: 'external', name: 'Rafa Quintero', email: 'rafa@ext.test', role: 'lyricist', bps: 4000 },
  ]);
  await S.proposeNewVersion(deps, diego.id, W.corrido, 'corrección', ctx);
  await S.submitForSignatures(deps, diego.id, W.corrido, ctx);
  const d = (await S.getWorkDetail(deps, diego.id, W.corrido))!;
  const share = d.versions[0]!.parties.find((p) => !p.isMe)!;
  const [row] = await deps.db.select().from(t.splitShares).where(eq(t.splitShares.id, share.shareId));
  const token = S.guestSignToken(deps.signingSecret, row!.id, new Date(row!.invitedAt!).toISOString());
  await S.sendGuestCode(deps, token, 'es');
  await S.rejectAsGuest(deps, token, h.lastCodeFor('rafa@ext.test'), 'La letra es mía: pido 50 %', ctx);
  expect((await S.getWorkDetail(deps, diego.id, W.corrido))!.work.status).toBe('disputed');
  await S.dispatchPending(deps, { limit: 500 });
}, 120_000);

describe('pipeline de statements con el archivo ficticio (criterio 3)', () => {
  let periodId = '';

  it('ingesta y normaliza el archivo crudo, que queda inmutable', async () => {
    periodId = await S.statements.createPeriod(deps, ops, { code: '2026-Q2', payDate: '2026-08-15' }, ctx);
    const up = await S.statements.uploadStatement(deps, ops, { periodId, fileName: '2026-Q2.csv', bytes: fixture('2026-Q2.csv') }, ctx);
    expect(up.lines).toBe(12);
    expect(up.errors).toEqual([]);
    expect(up.matching).toEqual({ auto: 10, suggested: 1, unmatched: 1 });
    await expect(S.statements.uploadStatement(deps, ops, { periodId, fileName: 'otra-vez.csv', bytes: fixture('2026-Q2.csv') }, ctx)).rejects.toThrow('FILE_ALREADY_UPLOADED');
    const [f] = await deps.db.select().from(t.statementFiles).where(eq(t.statementFiles.id, up.fileId));
    expect(f!.sha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(deps.db.update(t.statementFiles).set({ storagePath: 'otra' }).where(eq(t.statementFiles.id, up.fileId))).rejects.toThrow();
  });

  it('casa por código, ISWC e IPI + título; lo demás va a la cola con sugerencias', async () => {
    const lines = await deps.db.execute<{ line_no: number; match_status: string; match_method: string | null; matched_work_id: string | null }>(sql`
      select l.line_no, l.match_status, l.match_method, l.matched_work_id from statement_lines l join statement_files f on f.id = l.file_id where f.period_id = ${periodId} order by l.line_no`);
    const by = Object.fromEntries(lines.map((l) => [l.line_no, l]));
    expect(by[2]).toMatchObject({ match_method: 'publisher_code', matched_work_id: W.luna });
    expect(by[5]).toMatchObject({ match_method: 'iswc', matched_work_id: W.luna });
    expect(by[9]).toMatchObject({ match_method: 'iswc', matched_work_id: W.midnight });
    expect(by[10]).toMatchObject({ match_method: 'ipi_title', matched_work_id: W.corrido });
    expect(by[11]!.match_status).toBe('suggested');
    expect(by[12]!.match_status).toBe('unmatched');
    const queue = await S.statements.matchingQueue(deps, periodId);
    expect(queue.find((q) => q.line_no === 11)!.suggestions[0]!.workId).toBe(W.luna);
  });

  it('sin tasa de cambio documentada no calcula', async () => {
    await expect(S.statements.calculateRun(deps, ops, periodId, '1442.17', ctx)).rejects.toThrow('FX_RATE_MISSING');
    await S.statements.setFxRate(deps, ops, { base: 'EUR', rate: '1.0850', asOf: '2026-08-14', source: 'Banco Central Europeo' }, ctx);
  });

  it('un centavo de diferencia con lo recibido bloquea aprobación y publicación', async () => {
    const r = await S.statements.calculateRun(deps, ops, periodId, '1442.16', ctx);
    expect(r.reconciliation.balanced).toBe(false);
    expect(r.reconciliation.differenceCents).toBe(-1);
    await expect(S.statements.approveRun(deps, appr, r.runId, ctx)).rejects.toThrow('RUN_UNBALANCED');
    await expect(S.statements.publishRun(deps, ops, r.runId, ctx)).rejects.toThrow('RUN_NOT_APPROVED');
  });

  it('match manual (aprende un alias), recálculo y conciliación exacta', async () => {
    const queue = await S.statements.matchingQueue(deps, periodId);
    await S.statements.manualMatch(deps, ops, queue.find((q) => q.line_no === 11)!.id, W.luna!, ctx);
    await S.statements.sendToSuspense(deps, ops, queue.find((q) => q.line_no === 12)!.id, ctx);
    const r = await S.statements.calculateRun(deps, ops, periodId, '1442.17', ctx);
    const rec = r.reconciliation;
    expect(rec.balanced).toBe(true);
    expect(rec.controlTotalCents).toBe(144217);
    expect(rec.parsedTotalCents).toBe(144217);
    expect(rec.writersNetCents + rec.commissionCents + rec.withholdingCents + rec.recoupmentCents + rec.heldCents + rec.suspenseCents + rec.roundingCents).toBe(144217);
    // Corrido (64,30) en disputa: 60 % de Diego retenido; 40 % del externo a suspenso
    expect(rec.heldCents).toBe(3858);
    const sam = rec.writers.find((w) => w.writerUserId === W.sam)!;
    // Midnight: (310,75 + 88,20) × 50 % × (1 − 15 %) = 169,55375
    expect(Math.abs(sam.netCents - 16955)).toBeLessThanOrEqual(1);
    for (const w of rec.writers) expect(w.grossCents).toBe(w.netCents + w.commissionCents + w.withholdingCents);
  });
});

describe('aprobación y publicación (criterio 4)', () => {
  let runId = '';
  let periodId = '';

  beforeAll(async () => {
    const [p] = await deps.db.select().from(t.statementPeriods).where(eq(t.statementPeriods.code, '2026-Q2'));
    periodId = p!.id;
    const [run] = await deps.db.select().from(t.distributionRuns).where(and(eq(t.distributionRuns.periodId, periodId), eq(t.distributionRuns.status, 'reconciled')));
    runId = run!.id;
  });

  it('quien calculó no puede aprobar', async () => {
    await expect(S.statements.approveRun(deps, ops, runId, ctx)).rejects.toThrow(/FORBIDDEN|APPROVER_MUST_DIFFER/);
    await S.statements.approveRun(deps, appr, runId, ctx);
  });

  it('vista previa y envío de prueba al operador', async () => {
    const pv = await S.statements.publicationPreview(deps, runId);
    expect(pv.writers).toBeGreaterThanOrEqual(3);
    await S.statements.sendTestStatementEmail(deps, ops, runId);
    expect(h.mails().some((m) => m.tag === 'statement_test' && m.subject.startsWith('[PRUEBA]'))).toBe(true);
  });

  it('publica: un statement por autor, ledger acreditado, PDF igual al dashboard y un solo correo en su idioma', async () => {
    const r = await S.statements.publishRun(deps, ops, runId, ctx);
    expect(r.published).toBeGreaterThanOrEqual(3);
    await S.dispatchPending(deps, { limit: 500 });
    await S.dispatchPending(deps, { limit: 500 });

    for (const id of [W.vale!, W.diego!, W.sam!]) {
      const [ws] = await deps.db.select().from(t.writerStatements).where(and(eq(t.writerStatements.writerUserId, id), eq(t.writerStatements.periodId, periodId)));
      expect(ws).toBeTruthy();
      const [credit] = await deps.db.select().from(t.writerLedgerEntries).where(eq(t.writerLedgerEntries.writerStatementId, ws!.id));
      expect(Number(credit?.amountCents ?? 0)).toBe(Number(ws!.netCents));
      // Vista del dashboard = datos del PDF (mismo modelo)
      const view = (await S.statements.getMyStatement(deps, id, ws!.id))!;
      expect(view.totals.netCents).toBe(Number(ws!.netCents));
      expect(view.pdfPath).toBeTruthy();
      expect(view.pdfSha256).toMatch(/^[0-9a-f]{64}$/);
      const pdf = await deps.storage.get('documents', view.pdfPath!.replace(/^documents\//, ''));
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      // Otro autor no puede ver este statement (RLS)
      const other = id === W.sam ? W.vale! : W.sam!;
      expect(await S.statements.getMyStatement(deps, other, ws!.id)).toBeNull();
    }
    const [diegoSt] = await deps.db.select().from(t.writerStatements).where(and(eq(t.writerStatements.writerUserId, W.diego!), eq(t.writerStatements.periodId, periodId)));
    expect(Number(diegoSt!.heldCents)).toBe(3858);

    const mails = h.mails().filter((m) => m.tag === 'statement_published' || m.tag === 'statement_published_zero');
    const samMail = mails.filter((m) => m.subject.includes('statement') && m.subject.includes('2026-Q2') && /ready/.test(m.subject));
    expect(samMail).toHaveLength(1); // Sam, en inglés
    const keys = await deps.db.execute<{ n: number }>(sql`select count(*)::int as n from notifications where template like 'statement_published%' group by idempotency_key having count(*) > 1`);
    expect(keys).toHaveLength(0);
  });

  it('avisa a Diego de regalías sin reclamar con su IPI, una sola vez por período', async () => {
    const unclaimed = h.mails().filter((m) => m.tag === 'royalties_unclaimed');
    expect(unclaimed).toHaveLength(1);
    expect(unclaimed[0]!.text).toContain('CANCION QUE NO EXISTE');
    const [diego] = await deps.db.select().from(t.users).where(eq(t.users.id, W.diego!));
    expect(unclaimed[0]!.to).toBe(diego!.email);
    // Volver a detectar no repite el aviso
    await deps.db.transaction((tx) => S.statements.detectUnclaimed(tx, periodId));
    await S.dispatchPending(deps, { limit: 500 });
    expect(h.mails().filter((m) => m.tag === 'royalties_unclaimed')).toHaveLength(1);
    // Seguimiento del envío del período en el back-office
    const stats = await S.notifications.deliveryStats(deps, ops, { periodId });
    expect(stats.email?.sent).toBeGreaterThanOrEqual(3);
  });

  it('publicar de nuevo no duplica nada', async () => {
    expect(await S.statements.publishRun(deps, ops, runId, ctx)).toEqual({ published: 0 });
    const n = await deps.db.execute<{ n: number }>(sql`select count(*)::int as n from writer_statements where period_id = ${periodId}`);
    const before = n[0]!.n;
    await S.dispatchPending(deps, { limit: 500 });
    const n2 = await deps.db.execute<{ n: number }>(sql`select count(*)::int as n from writer_statements where period_id = ${periodId}`);
    expect(n2[0]!.n).toBe(before);
  });

  it('el período publicado queda cerrado y todo quedó auditado', async () => {
    await expect(S.statements.uploadStatement(deps, ops, { periodId, fileName: 'q1.csv', bytes: fixture('2026-Q1.csv') }, ctx)).rejects.toThrow('PERIOD_ALREADY_PUBLISHED');
    const cmds = await deps.db.execute<{ command: string }>(sql`select distinct command from audit_log where command like 'statement.%'`);
    expect(cmds.map((c) => c.command)).toEqual(expect.arrayContaining(['statement.upload', 'statement.calculate', 'statement.approve', 'statement.publish', 'statement.manual_match']));
    expect((await deps.db.execute<{ b: string | null }>(sql`select audit_verify_chain() as b`))[0]!.b).toBeNull();
  });
});

describe('cambio de plan antes de publicar', () => {
  it('invalida la corrida: la comisión es la del plan vigente al publicar', async () => {
    const pid = await S.statements.createPeriod(deps, ops, { code: '2026-Q3', payDate: '2026-11-15' }, ctx);
    await S.statements.uploadStatement(deps, ops, { periodId: pid, fileName: '2026-Q1.csv', bytes: fixture('2026-Q1.csv') }, ctx);
    const r = await S.statements.calculateRun(deps, ops, pid, '650.65', ctx);
    expect(r.reconciliation.balanced).toBe(true);
    await S.statements.approveRun(deps, appr, r.runId, ctx);
    h.clock.now = new Date('2026-11-01T12:00:00Z');
    await S.upgradeToPro(deps, W.diego!, ctx);
    await expect(S.statements.publishRun(deps, ops, r.runId, ctx)).rejects.toThrow('RUN_STALE_PLAN_CHANGED');
    h.clock.now = new Date('2026-10-05T15:00:00Z');
  });
});

describe('retiros con doble aprobación', () => {
  it('exige KYC, datos fiscales y método; reserva el saldo; aprueba otra persona', async () => {
    const vale = W.vale!;
    const balance = await S.payouts.balanceCents(deps, vale);
    expect(balance).toBeGreaterThan(5000);
    await expect(S.payouts.requestPayout(deps, vale, 5000, ctx)).rejects.toThrow('KYC_REQUIRED');
    await S.payouts.requestKyc(deps, vale, ctx);
    await S.admin.setKycStatus(deps, ops, vale, 'approved', ctx);
    await expect(S.payouts.requestPayout(deps, vale, 5000, ctx)).rejects.toThrow('TAX_PROFILE_REQUIRED');
    await S.payouts.saveTaxProfile(deps, vale, { taxCountry: 'CO', taxId: '1.020.304.050', entityType: 'individual' }, ctx);
    await S.payouts.savePayoutMethod(deps, vale, { provider: 'wise', holderName: 'Valentina Ríos', account: 'CO12 3456 7890 1234', bankName: 'Bancolombia', currency: 'COP' }, ctx);
    await expect(S.payouts.requestPayout(deps, vale, 1000, ctx)).rejects.toThrow('PAYOUT_BELOW_MINIMUM');
    await expect(S.payouts.requestPayout(deps, vale, balance + 1, ctx)).rejects.toThrow('PAYOUT_ABOVE_BALANCE');
    const id = await S.payouts.requestPayout(deps, vale, 5000, ctx);
    expect(await S.payouts.balanceCents(deps, vale)).toBe(balance - 5000);

    const batch = await S.payouts.preparePayoutBatch(deps, ops, [id], ctx);
    await deps.db.insert(t.userRoles).values({ userId: ops, role: 'approver' }).onConflictDoNothing();
    await expect(S.payouts.approvePayoutBatch(deps, ops, batch, ctx)).rejects.toThrow('APPROVER_MUST_DIFFER');
    await S.payouts.approvePayoutBatch(deps, appr, batch, ctx);
    const csv = await S.payouts.payoutBatchCsv(deps, appr, batch);
    expect(csv).toContain('Valentina Ríos');
    expect(csv).toContain('CO12 3456 7890 1234');
    // los datos bancarios están cifrados en la base
    const raw = await deps.db.execute<{ d: string }>(sql`select encode(details_enc, 'escape') as d from payout_methods where user_id = ${vale}`);
    expect(raw[0]!.d).not.toContain('1234 5678');
    expect(raw[0]!.d).not.toContain('Bancolombia');
    await S.payouts.markPayoutSent(deps, ops, id, 'WISE-TR-998877', ctx);
    await S.dispatchPending(deps, { limit: 100 });
    expect(h.mails().some((m) => m.tag === 'payout_sent')).toBe(true);
  });
});
