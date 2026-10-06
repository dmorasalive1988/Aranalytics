/**
 * Datos de ejemplo en español, inglés y portugués de Brasil (desarrollo y demo).
 * Todas las cuentas usan la contraseña SAMPLE_PASSWORD.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FakePayments, hashDevPassword } from '@pluma/adapters';
import { eq, inArray, sql, t } from '@pluma/db';
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
  // 2025-Q3 y 2025-Q4: historia con varias plataformas y países (analítica Pro)
  await publishDemoHistory(deps, ops, approver, opts.fixturesDir);
  // 2026-Q1: procesado y publicado (historia para el dashboard)
  const q1 = await S.statements.createPeriod(deps, ops, { code: '2026-Q1', payDate: '2026-05-15' }, ctx);
  // Versión del demo: las líneas de 2026-Q1.csv más plataformas y países (la original la usan las pruebas).
  const q1File = readFileSync(join(opts.fixturesDir, 'demo', '2026-Q1.csv'));
  await S.statements.uploadStatement(deps, ops, { periodId: q1, fileName: '2026-Q1.csv', bytes: q1File }, ctx);
  const run1 = await S.statements.calculateRun(deps, ops, q1, controlTotal(q1File), ctx);
  await S.statements.approveRun(deps, approver, run1.runId, ctx);
  await S.statements.publishRun(deps, ops, run1.runId, ctx);
  // 2026-Q2: archivo cargado y normalizado; falta la tasa EUR, el matching manual, el cálculo y la publicación
  const q2 = await S.statements.createPeriod(deps, ops, { code: '2026-Q2', payDate: '2026-11-15' }, ctx);
  await S.statements.uploadStatement(deps, ops, { periodId: q2, fileName: '2026-Q2.csv', bytes: readFileSync(join(opts.fixturesDir, '2026-Q2.csv')) }, ctx);

  log('Red Pluma…');
  const P = S.profiles;
  await P.updateNetworkProfile(deps, valentina, { bio: 'Compositora y topliner de Medellín. Reggaetón, pop urbano y baladas.', languages: ['es', 'en'], mainRole: 'composer_lyricist', dspLinks: { spotify: 'https://open.spotify.com/artist/pluma-demo-vale' } }, ctx);
  await P.updateNetworkProfile(deps, diego, { bio: 'Productor de corridos tumbados y regional mexicano desde Guadalajara.', languages: ['es'], mainRole: 'composer', dspLinks: {} }, ctx);
  await P.updateNetworkProfile(deps, sam, { bio: 'Miami-based writer. Latin pop, R&B and Spanglish hooks.', languages: ['en', 'es'], mainRole: 'composer_lyricist', dspLinks: { apple: 'https://music.apple.com/artist/pluma-demo-sam' } }, ctx);
  await P.updateNetworkProfile(deps, camila, { bio: 'Compositora pernambucana. Forró, piseiro e MPB.', languages: ['pt', 'es'], mainRole: 'lyricist', dspLinks: {} }, ctx);
  await P.addCredit(deps, valentina, { title: 'Noche en El Poblado', artist: 'Artista de ejemplo', role: 'Compositora', dspUrl: 'https://open.spotify.com/track/pluma-demo' }, ctx);
  const [vc] = (await P.pendingCredits(deps, ops)).filter((c) => c.title === 'Noche en El Poblado');
  if (vc) await P.reviewCredit(deps, ops, vc.id, true, '', ctx);
  await P.addCredit(deps, sam, { title: 'Ocean Drive Lights', artist: 'Sample Artist', role: 'Co-writer', dspUrl: 'https://music.apple.com/song/pluma-demo' }, ctx);

  const N = S.network;
  const beat = { bytes: demoWav(8), mime: 'audio/wav' };
  const rSam = await N.createRequest(deps, sam, { type: 'beat_seeks_topliner', title: 'Latin R&B beat needs a topliner', description: 'Smooth 92 BPM beat with Rhodes and 808s. Looking for a bilingual hook and verses.', genre: 'Latin R&B', languages: ['en', 'es'], bpm: 92, city: null, modality: 'remote', offeredShareBps: 4500 }, beat, ctx);
  const rVale = await N.createRequest(deps, valentina, { type: 'session_or_camp', title: 'Writing camp de reggaetón en Medellín', description: 'Tres días de sesiones en estudio, del 20 al 22 de noviembre. Buscamos productores y topliners.', genre: 'Reggaetón', languages: ['es'], bpm: null, city: 'Medellín', modality: 'in_person', offeredShareBps: 2500 }, null, ctx);
  const rCami = await N.createRequest(deps, camila, { type: 'seeks_producer', title: 'Procuro produtor para forró eletrônico', description: 'Tenho letra e melodia prontas. Preciso de produção com sanfona e batida eletrônica.', genre: 'Forró eletrônico', languages: ['pt'], bpm: 128, city: 'Recife', modality: 'hybrid', offeredShareBps: 3500 }, null, ctx);
  const rDiego = await N.createRequest(deps, diego, { type: 'seeks_verse_or_hook', title: 'Busco coro para corrido tumbado', description: 'La instrumental ya está. Falta un coro que se quede en la cabeza, estilo calle pero melódico.', genre: 'Corrido tumbado', languages: ['es'], bpm: 140, city: null, modality: 'remote', offeredShareBps: 3000 }, null, ctx);
  await N.apply(deps, diego, rSam, { message: 'Puedo meterle un coro en español con sabor regional, ¿te late?', acceptShare: true, sample: null }, ctx);
  await N.apply(deps, camila, rVale, { message: 'Adoraria participar do camp! Escrevo em português e espanhol.', acceptShare: true, sample: null }, ctx);
  const aVale = await N.apply(deps, valentina, rDiego, { message: 'Tengo un coro que encaja perfecto con ese corrido. Escúchalo en la sesión.', acceptShare: true, sample: null }, ctx);
  await N.acceptApplication(deps, diego, aVale, ctx);
  void rCami;

  log('Catálogo A&R y Pluma Sync…');
  const C = S.catalog;
  // Demos y metadatos de las obras en catálogo (la versión de escucha se prepara al activar el opt-in)
  await S.attachDemo(deps, valentina, w5, { bytes: demoWav(10), mime: 'audio/wav' }, ctx);
  await C.updateCatalogMetadata(deps, valentina, w5, { bpm: 96, musicalKey: 'Am', moods: ['happy', 'party', 'nostalgic'], vocals: 'female', instrumentalAvailable: true, description: 'Cumbia luminosa con acordeón y guacharaca; ideal para verano, playa y celebraciones.' }, ctx);
  await S.setCatalogOptIns(deps, valentina, w5, { sync: true, ar: true, oneStop: true }, ctx);
  await S.attachDemo(deps, valentina, w1, { bytes: demoWav(10), mime: 'audio/wav' }, ctx);
  await C.updateCatalogMetadata(deps, valentina, w1, { bpm: 92, musicalKey: 'F#m', moods: ['romantic', 'sensual'], vocals: 'female', instrumentalAvailable: false, description: 'Reggaetón romántico de noche en Medellín.' }, ctx);
  await S.setCatalogOptIns(deps, valentina, w1, { sync: true }, ctx);
  await S.attachDemo(deps, sam, w2, { bytes: demoWav(10), mime: 'audio/wav' }, ctx);
  await C.updateCatalogMetadata(deps, sam, w2, { bpm: 104, musicalKey: 'C', moods: ['uplifting', 'chill'], vocals: 'duet', instrumentalAvailable: true, description: 'Latin pop bilingüe, luminoso, con guitarras y sintetizadores. Miami de noche.' }, ctx);
  await S.setCatalogOptIns(deps, sam, w2, { sync: true }, ctx);

  // Comprador de sync y A&R invitado
  const buyer = await account('compras@agenciafaro.test', 'es');
  await C.registerBuyer(deps, buyer, { company: 'Agencia Faro', companyType: 'agency', country: 'MX' }, ctx);
  const arUser = await account('ar@selloandino.test', 'es');
  const invId = await C.inviteAr(deps, admin, { email: 'ar@selloandino.test', company: 'Sello Andino' }, ctx);
  const [inv] = await deps.db.select().from(t.arInvitations).where(eq(t.arInvitations.id, invId));
  await C.acceptArInvitation(deps, arUser, C.arInviteUrl(deps, inv!.id).split('/').pop()!, ctx);
  await C.expressInterest(deps, arUser, w5, 'Nos encanta para el próximo sencillo de nuestra artista.', ctx);
  await C.requestHold(deps, arUser, w5, 60, 'Queremos grabarla en diciembre.', ctx);

  // Solicitud de licencia esperando a los autores y un brief abierto
  await C.requestLicense(deps, buyer, w2, { usage: 'digital_ads', territory: 'US', termMonths: 12, project: 'Campaña digital de una marca de bebidas para el verano en Miami.', oneStop: false }, ctx);
  await C.createBrief(deps, buyer, { title: 'Cumbia o reggaetón alegre para campaña de verano', description: 'Spot de 30 s para TV y redes en México. Buscamos energía de playa, voz femenina o instrumental.', moods: ['happy', 'party'], genres: ['cumbia', 'reggaeton'], languages: ['es'], usage: 'digital_ads', territory: 'LATAM', termMonths: 12, budgetMinCents: 200000, budgetMaxCents: 500000, deadline: null }, ctx);

  await S.dispatchPending(deps, { limit: 500 });
  return true;
}

/** Demo de ejemplo: acordes simples en WAV (sin archivos binarios en el repositorio). */
function demoWav(seconds: number) {
  const sr = 22050;
  const n = sr * seconds;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24);
  b.writeUInt32LE(sr * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  const chords = [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 293.66]];
  for (let i = 0; i < n; i++) {
    const tSec = i / sr;
    const chord = chords[Math.floor(tSec / 2) % chords.length]!;
    const env = Math.min(1, (tSec % 2) * 8) * Math.exp(-(tSec % 2) * 0.8);
    const v = chord.reduce((a, f) => a + Math.sin(2 * Math.PI * f * tSec), 0) / chord.length;
    b.writeInt16LE(Math.round(9000 * env * v), 44 + i * 2);
  }
  return b;
}

/** Total de control en USD del archivo (línea T). */
const controlTotal = (bytes: Buffer) => /\nT,[^\n]*,USD,,,([\d.]+),/.exec(bytes.toString())![1]!;

/** Períodos de historia del demo (2025-Q3 y 2025-Q4), publicados en orden. */
const HISTORY = [
  { code: '2025-Q3', payDate: '2025-11-15' },
  { code: '2025-Q4', payDate: '2026-02-15' },
] as const;

async function publishDemoHistory(deps: Deps, ops: string, approver: string, fixturesDir: string) {
  const existing = new Set((await deps.db.select({ code: t.statementPeriods.code }).from(t.statementPeriods)).map((p) => p.code));
  let added = 0;
  for (const h of HISTORY) {
    if (existing.has(h.code)) continue;
    const bytes = readFileSync(join(fixturesDir, `${h.code}.csv`));
    const total = controlTotal(bytes);
    const period = await S.statements.createPeriod(deps, ops, h, ctx);
    await S.statements.uploadStatement(deps, ops, { periodId: period, fileName: `${h.code}.csv`, bytes }, ctx);
    const run = await S.statements.calculateRun(deps, ops, period, total, ctx);
    await S.statements.approveRun(deps, approver, run.runId, ctx);
    await S.statements.publishRun(deps, ops, run.runId, ctx);
    added++;
  }
  return added;
}

/**
 * Demo ya cargado antes de la analítica Pro: agrega los períodos de historia si faltan.
 * Usa las cuentas de operaciones y aprobaciones del demo; si no existen, no hace nada.
 */
export async function ensureDemoHistory(deps: Deps, fixturesDir: string) {
  const staff = await deps.db.select({ id: t.users.id, email: t.users.email }).from(t.users).where(inArray(t.users.email, ['operaciones@pluma.test', 'aprobaciones@pluma.test']));
  const ops = staff.find((u) => u.email === 'operaciones@pluma.test')?.id;
  const approver = staff.find((u) => u.email === 'aprobaciones@pluma.test')?.id;
  if (!ops || !approver) return 0;
  const added = await publishDemoHistory(deps, ops, approver, fixturesDir);
  if (added) await S.dispatchPending(deps, { limit: 500 });
  return added;
}
