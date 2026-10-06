/**
 * Datos de ejemplo en español, inglés y portugués de Brasil (desarrollo y demo).
 * Todas las cuentas usan la contraseña SAMPLE_PASSWORD.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakePayments, hashDevPassword } from '@pluma/adapters';
import { eq, sql, t } from '@pluma/db';
import * as S from './index';
import type { Deps } from './deps';
import { createChallengeForSeed } from './cli/seed-helpers';

export const SAMPLE_PASSWORD = 'pluma-dev-2026';
const PASSWORD = SAMPLE_PASSWORD;
const ctx = { ip: '127.0.0.1', userAgent: 'seed' };

/** Carga los datos de ejemplo. Devuelve false si la base ya tenía usuarios (no toca nada). */
export async function seedSampleData(deps: Deps, opts: { accountsTable: 'auth.users' | 'pluma_demo.accounts'; fixturesDir: string; log?: (m: string) => void }): Promise<boolean> {
  const log = opts.log ?? console.log;
  const accounts = sql.raw(opts.accountsTable === 'pluma_demo.accounts' ? 'pluma_demo.accounts' : 'auth.users');

  const existing = await deps.db.select({ id: t.users.id }).from(t.users).limit(1);
  if (existing.length) return false;

  async function account(email: string, locale: S.AppLocale) {
    const [row] = await deps.db.execute<{ id: string }>(sql`insert into ${accounts} (email, encrypted_password, email_confirmed_at, raw_user_meta_data) values (${email}, ${await hashDevPassword(PASSWORD)}, now(), ${JSON.stringify({ locale })}::jsonb) returning id`);
    await S.ensureAppUser(deps, { id: row!.id, email, emailVerified: true }, locale);
    return row!.id;
  }

  const fake = deps.payments as FakePayments;
  async function writer(p: { email: string; locale: S.AppLocale; legalName: string; artistName: string; country: string; city: string; birthDate: string; society: string | null; other?: string; ipi?: string; plan: 'socio' | 'pro' }) {
    const id = await account(p.email, p.locale);
    await S.saveProfile(deps, id, { legalName: p.legalName, artistName: p.artistName, country: p.country, city: p.city, birthDate: p.birthDate }, ctx);
    await S.saveSociety(deps, id, { societyCode: p.society, societyOther: p.other ?? null, ipi: p.ipi ?? null }, ctx);
    await S.choosePlan(deps, id, p.plan, ctx);
    await S.signAdminAgreement(deps, id, ctx);
    const plans = await S.loadPlans(deps);
    for (const ev of fake.completeCheckout(id, p.plan, plans[p.plan].amountCents)) await S.applyPaymentEvent(deps, ev);
    return id;
  }

  log('Creando cuentas…');
  const valentina = await writer({ email: 'valentina@pluma.test', locale: 'es', legalName: 'Valentina Ríos Mejía', artistName: 'Vale Ríos', country: 'CO', city: 'Medellín', birthDate: '1995-08-14', society: 'SAYCO', ipi: '00712345678', plan: 'pro' });
  const diego = await writer({ email: 'diego@pluma.test', locale: 'es', legalName: 'Diego Armando Morales', artistName: 'Dieguito Beats', country: 'MX', city: 'Guadalajara', birthDate: '1991-02-03', society: 'SACM', plan: 'socio' });
  const sam = await writer({ email: 'sam@pluma.test', locale: 'en', legalName: 'Samantha Rivera', artistName: 'Sam Rivera', country: 'US', city: 'Miami', birthDate: '1993-11-21', society: 'ASCAP', ipi: '00598765432', plan: 'pro' });
  const camila = await writer({ email: 'camila@pluma.test', locale: 'pt-BR', legalName: 'Camila Duarte Souza', artistName: 'Cami Duarte', country: 'BR', city: 'Recife', birthDate: '1997-04-30', society: 'UBC', plan: 'socio' });

  const ops = await account('operaciones@pluma.test', 'es');
  const approver = await account('aprobaciones@pluma.test', 'es');
  const admin = await account('admin@pluma.test', 'es');
  await deps.db.insert(t.userRoles).values([
    { userId: ops, role: 'operator' },
    { userId: approver, role: 'approver' },
    { userId: admin, role: 'super_admin' },
    { userId: admin, role: 'operator' },
  ]);
  await deps.db.update(t.users).set({ mfaRequired: true }).where(eq(t.users.id, ops));

  log('Registrando obras…');
  await S.saveSociety(deps, diego, { societyCode: 'SACM', societyOther: null, ipi: '00712345679' }, ctx);

  async function signPending(workId: string, ownerId: string) {
    const d = (await S.getWorkDetail(deps, ownerId, workId))!;
    for (const p of d.versions[0]!.parties.filter((x) => x.status === 'pending')) {
      const [share] = await deps.db.select().from(t.splitShares).where(eq(t.splitShares.id, p.shareId));
      if (share!.writerUserId) await S.signAsMember(deps, share!.writerUserId, share!.id, ctx);
      else {
        const token = S.guestSignToken(deps.signingSecret, share!.id, new Date(share!.invitedAt!).toISOString());
        const code = await deps.db.transaction((tx) => createChallengeForSeed(tx, share!.externalEmail!, share!.id));
        await S.signAsGuest(deps, token, code, ctx);
      }
    }
  }
  const lyricsWork = (title: string, language: string, genre: string, lyrics: string | null, isrcs: string[] = [], ai: 'none' | 'ai_assisted' = 'none') => ({ title, altTitles: [], language, genre, lyrics, aiDeclaration: ai, isrcs });

  // 1. Registrada · 4 coautores (2 socios, 2 externos)
  const w1 = await S.createWork(deps, valentina, { ...lyricsWork('Luna de Medellín', 'es', 'Reggaetón', 'Luna de Medellín, no me dejes así\nque la noche es larga y te quiero aquí', ['CO-A1B-25-00071']), altTitles: ['Luna de Medallo'] }, ctx);
  await S.setDraftSplit(deps, valentina, w1, [
    { kind: 'member', userId: valentina, role: 'composer_lyricist', bps: 4000 },
    { kind: 'member', userId: diego, role: 'composer', bps: 3000 },
    { kind: 'external', name: 'Andrés Cano', email: 'andres.cano@ejemplo.co', role: 'lyricist', bps: 1500 },
    { kind: 'external', name: 'Lina Zapata', email: 'lina.zapata@ejemplo.co', role: 'arranger', bps: 1500 },
  ], ctx);
  await S.submitForSignatures(deps, valentina, w1, ctx);
  await signPending(w1, valentina);

  // 2. Registrada · 100 % Valentina, con sync y A&R
  const w5 = await S.createWork(deps, valentina, lyricsWork('Cumbia del Río Grande', 'es', 'Cumbia', null), ctx);
  await S.submitForSignatures(deps, valentina, w5, ctx);
  await S.setCatalogOptIns(deps, valentina, w5, { sync: true, ar: true }, ctx);

  // 3. Registrada · en inglés, Sam + Valentina + externo
  const w2 = await S.createWork(deps, sam, lyricsWork('Midnight in Wynwood', 'en', 'Latin pop', 'Midnight in Wynwood, painted walls and you\nSpanglish on the radio, nothing feels brand new', [], 'ai_assisted'), ctx);
  await S.setDraftSplit(deps, sam, w2, [
    { kind: 'member', userId: sam, role: 'composer_lyricist', bps: 5000 },
    { kind: 'member', userId: valentina, role: 'lyricist', bps: 2500 },
    { kind: 'external', name: 'Marcus Lee', email: 'marcus.lee@example.com', role: 'composer', bps: 2500 },
  ], ctx);
  await S.submitForSignatures(deps, sam, w2, ctx);
  await signPending(w2, sam);

  await S.admin.exportNewWorks(deps, ops, ctx);
  await S.admin.registerWork(deps, ops, w1, { publisherWorkCode: 'PLM-CO-000101', iswc: 'T-034.524.680-1' }, ctx);
  await S.admin.registerWork(deps, ops, w5, { publisherWorkCode: 'PLM-CO-000102', iswc: null }, ctx);
  await S.admin.registerWork(deps, ops, w2, { publisherWorkCode: 'PLM-US-000201', iswc: 'T-123.456.789-4' }, ctx);

  // 4. Esperando firmas (en inglés)
  const w3 = await S.createWork(deps, sam, lyricsWork('Coastline Prayer', 'en', 'R&B', 'Hold me like the coastline holds the tide'), ctx);
  await S.setDraftSplit(deps, sam, w3, [
    { kind: 'member', userId: sam, role: 'composer_lyricist', bps: 6000 },
    { kind: 'external', name: 'Jordan Blake', email: 'jordan.blake@example.com', role: 'composer', bps: 4000 },
  ], ctx);
  await S.submitForSignatures(deps, sam, w3, ctx);

  // 5. Borrador (en portugués), sin grabar
  await S.createWork(deps, camila, lyricsWork('Maré Cheia', 'pt', 'Forró eletrônico', 'Maré cheia no meu peito\nquando o sol se põe em Recife'), ctx);

  // 6. En disputa (sus regalías quedan retenidas)
  const w4 = await S.createWork(deps, diego, lyricsWork('Corrido del Desvelo', 'es', 'Corrido tumbado', 'Me agarró la madrugada\ncon la troca y sin dormir'), ctx);
  await S.setDraftSplit(deps, diego, w4, [
    { kind: 'member', userId: diego, role: 'composer', bps: 6000 },
    { kind: 'external', name: 'Rafa Quintero', email: 'rafa.quintero@ejemplo.mx', role: 'lyricist', bps: 4000 },
  ], ctx);
  await S.submitForSignatures(deps, diego, w4, ctx);
  {
    const d = (await S.getWorkDetail(deps, diego, w4))!;
    const share = d.versions[0]!.parties.find((p) => !p.isMe)!;
    const [row] = await deps.db.select().from(t.splitShares).where(eq(t.splitShares.id, share.shareId));
    const token = S.guestSignToken(deps.signingSecret, row!.id, new Date(row!.invitedAt!).toISOString());
    const code = await deps.db.transaction((tx) => createChallengeForSeed(tx, row!.externalEmail!, row!.id));
    await S.rejectAsGuest(deps, token, code, 'La letra es casi toda mía: pido 50 %', ctx);
  }
  await S.dispatchPending(deps, { limit: 500 });

  log('Procesando statements…');
  // 2026-Q1: procesado y publicado (historia para el dashboard)
  const q1 = await S.statements.createPeriod(deps, ops, { code: '2026-Q1', payDate: '2026-05-15' }, ctx);
  await S.statements.uploadStatement(deps, ops, { periodId: q1, fileName: '2026-Q1.csv', bytes: readFileSync(join(opts.fixturesDir, '2026-Q1.csv')) }, ctx);
  const run1 = await S.statements.calculateRun(deps, ops, q1, '650.65', ctx);
  await S.statements.approveRun(deps, approver, run1.runId, ctx);
  await S.statements.publishRun(deps, ops, run1.runId, ctx);
  // 2026-Q2: archivo cargado y normalizado; falta la tasa EUR, el matching manual, el cálculo y la publicación
  const q2 = await S.statements.createPeriod(deps, ops, { code: '2026-Q2', payDate: '2026-11-15' }, ctx);
  await S.statements.uploadStatement(deps, ops, { periodId: q2, fileName: '2026-Q2.csv', bytes: readFileSync(join(opts.fixturesDir, '2026-Q2.csv')) }, ctx);

  await S.dispatchPending(deps, { limit: 500 });
  return true;
}
