import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, t } from '@pluma/db';
import { makeHarness } from './harness';
import { signedWork } from './world';

const h = makeHarness();
const { S, deps, ctx, clock } = h;
afterAll(() => h.close());

function wav(seconds = 2) {
  const sr = 8000, n = sr * seconds;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(7000 * Math.sin((2 * Math.PI * 330 * i) / sr) * (1 - i / n)), 44 + i * 2);
  return b;
}

async function plainUser(email = `${randomUUID().slice(0, 8)}@buyer.test`, locale: 'es' | 'en' | 'pt-BR' = 'en') {
  const id = randomUUID();
  await S.ensureAppUser(deps, { id, email, emailVerified: true }, locale);
  return { id, email };
}

const W: Record<string, { id: string; email: string }> = {};
let ops = '';
let cumbia = '';
let ballad = '';
let licenseId = '';

beforeAll(async () => {
  W.vale = await h.onboardWriter({ plan: 'pro', name: 'Vale Ríos' });
  W.diego = await h.onboardWriter({ plan: 'pro', name: 'Diego Morales' });
  W.cami = await h.onboardWriter({ plan: 'socio', name: 'Cami Duarte', locale: 'pt-BR' });
  ops = (await h.onboardWriter({ name: 'Operadora' })).id;
  await deps.db.insert(t.userRoles).values({ userId: ops, role: 'operator' });
  cumbia = await signedWork(h, W.vale!.id, 'Cumbia del Verano', [
    { kind: 'member', userId: W.vale!.id, role: 'composer_lyricist', bps: 6000 },
    { kind: 'member', userId: W.diego!.id, role: 'composer', bps: 4000 },
  ]);
  ballad = await signedWork(h, W.vale!.id, 'Balada de Medianoche', [{ kind: 'member', userId: W.vale!.id, role: 'composer_lyricist', bps: 10000 }]);
  await deps.db.update(t.works).set({ genre: 'Cumbia' }).where(eq(t.works.id, cumbia));
  await deps.db.update(t.works).set({ genre: 'Balada' }).where(eq(t.works.id, ballad));
  await S.attachDemo(deps, W.vale!.id, cumbia, { bytes: wav(), mime: 'audio/wav' }, ctx);
  await S.dispatchPending(deps, { limit: 500 });
});

describe('opciones de catálogo (A31)', () => {
  it('Socio no puede activar sync; Pro sí, y se prepara la escucha protegida con forma de onda', async () => {
    const w = await signedWork(h, W.cami!.id, 'Forró da Saudade', [{ kind: 'member', userId: W.cami!.id, role: 'lyricist', bps: 10000 }]);
    await expect(S.setCatalogOptIns(deps, W.cami!.id, w, { sync: true }, ctx)).rejects.toThrow('PLAN_REQUIRES_PRO');
    await S.catalog.updateCatalogMetadata(deps, W.vale!.id, cumbia, { bpm: 96, musicalKey: 'Am', moods: ['happy', 'party', 'nope'], vocals: 'female', instrumentalAvailable: true, description: 'Cumbia luminosa para un verano en la costa.' }, ctx);
    await S.setCatalogOptIns(deps, W.vale!.id, cumbia, { sync: true, ar: true, oneStop: true }, ctx);
    await S.catalog.updateCatalogMetadata(deps, W.vale!.id, ballad, { bpm: 70, musicalKey: null, moods: ['romantic', 'sad'], vocals: 'male', instrumentalAvailable: false, description: 'Balada de piano y voz.' }, ctx);
    await S.setCatalogOptIns(deps, W.vale!.id, ballad, { sync: true }, ctx);
    const [w1] = await deps.db.select().from(t.works).where(eq(t.works.id, cumbia));
    expect(w1!.moods).toEqual(['happy', 'party']);
    const [preview] = await deps.db.select().from(t.workFiles).where(eq(t.workFiles.workId, cumbia)).then((r) => r.filter((f) => f.kind === 'demo_preview'));
    expect(preview).toBeTruthy();
    if (preview!.watermarkId) expect((preview!.waveform as number[]).length).toBe(64);
  });
});

describe('criterio 6: un comprador encuentra, cotiza y pide una licencia que llega a los autores', () => {
  let buyer = { id: '', email: '' };
  it('solo los compradores registrados entran al portal', async () => {
    buyer = await plainUser('supervisora@agencia.test');
    await expect(S.catalog.searchSync(deps, buyer.id, 'cumbia')).rejects.toThrow('FORBIDDEN');
    await expect(S.catalog.registerBuyer(deps, buyer.id, { company: 'A', companyType: 'agency', country: 'MX' }, ctx)).rejects.toThrow('COMPANY_REQUIRED');
    await S.catalog.registerBuyer(deps, buyer.id, { company: 'Agencia Faro', companyType: 'agency', country: 'MX' }, ctx);
  });

  it('la búsqueda en lenguaje natural aplica filtros duros y ordena por texto', async () => {
    const r = await S.catalog.searchSync(deps, buyer.id, 'cumbia alegre instrumental 90-100 bpm para un comercial de verano, one-stop');
    expect(r.filters).toMatchObject({ genres: ['cumbia'], moods: ['happy'], instrumental: true, bpmMin: 90, bpmMax: 100, oneStop: true });
    expect(r.items.map((i) => i.title)).toEqual(['Cumbia del Verano']);
    expect(r.items[0]!.previewFileId).toBeTruthy();
    const romantic = await S.catalog.searchSync(deps, buyer.id, 'romantic ballad with male vocals');
    expect(romantic.items.map((i) => i.title)).toEqual(['Balada de Medianoche']);
    // Los filtros de la pantalla mandan sobre lo que entendió el traductor
    expect((await S.catalog.searchSync(deps, buyer.id, '', { bpmMin: 60, bpmMax: 80 })).items.map((i) => i.title)).toEqual(['Balada de Medianoche']);
    // El comprador escucha dentro de Pluma (y queda registrado)
    expect(await S.authorizePlay(deps, buyer.id, r.items[0]!.previewFileId!, null)).not.toBeNull();
  });

  it('cotiza por uso, territorio y plazo (referencial)', async () => {
    expect(await S.catalog.quoteLicense(deps, { usage: 'digital_ads', territory: 'LATAM', termMonths: 12, oneStop: false })).toMatchObject({ minCents: 150000, maxCents: 400000, referential: true });
    expect(await S.catalog.quoteLicense(deps, { usage: 'digital_ads', territory: 'LATAM', termMonths: 24, oneStop: true })).toMatchObject({ minCents: 430000, maxCents: 1150000 });
    await expect(S.catalog.quoteLicense(deps, { usage: 'digital_ads', territory: 'MARS', termMonths: 12, oneStop: false })).rejects.toThrow('TERRITORY_INVALID');
  });

  it('la solicitud llega a cada autor socio para aprobarla', async () => {
    await expect(S.catalog.requestLicense(deps, buyer.id, ballad, { usage: 'tv_film', territory: 'US', termMonths: 12, project: 'Serie de TV, episodio 3.', oneStop: true }, ctx)).rejects.toThrow('ONE_STOP_UNAVAILABLE');
    licenseId = await S.catalog.requestLicense(deps, buyer.id, cumbia, { usage: 'digital_ads', territory: 'LATAM', termMonths: 12, project: 'Campaña de verano para una marca de bebidas en redes y YouTube.', oneStop: true }, ctx);
    await S.dispatchPending(deps, { limit: 500 });
    for (const w of [W.vale!, W.diego!]) {
      const m = h.mails().find((x) => x.to === w.email && x.tag === 'license_requested');
      expect(m?.subject).toContain('Agencia Faro');
      expect(m?.text).toContain('Publicidad digital');
      expect((await S.catalog.licensesForWriter(deps, w.id)).find((l) => l.id === licenseId)?.my_decision).toBeNull();
    }
  });

  it('todos aprueban → el operador negocia y emite con la comisión de sync; el comprador recibe cada cambio', async () => {
    await S.catalog.decideLicense(deps, W.vale!.id, licenseId, true, ctx);
    await expect(S.catalog.decideLicense(deps, W.vale!.id, licenseId, true, ctx)).rejects.toThrow('LICENSE_NOT_PENDING');
    await expect(S.catalog.setLicenseStatus(deps, ops, licenseId, 'issued', { finalFeeCents: 300000 }, ctx)).rejects.toThrow('LICENSE_TRANSITION_INVALID');
    await S.catalog.decideLicense(deps, W.diego!.id, licenseId, true, ctx);
    await S.catalog.setLicenseStatus(deps, ops, licenseId, 'negotiating', { note: 'Propuesta enviada' }, ctx);
    await expect(S.catalog.setLicenseStatus(deps, ops, licenseId, 'issued', {}, ctx)).rejects.toThrow('FEE_REQUIRED');
    await S.catalog.setLicenseStatus(deps, ops, licenseId, 'issued', { finalFeeCents: 520000 }, ctx);
    const [r] = await deps.db.select().from(t.licenseRequests).where(eq(t.licenseRequests.id, licenseId));
    expect(r).toMatchObject({ status: 'issued', plumaCommissionBps: 3000 });
    await S.dispatchPending(deps, { limit: 500 });
    const updates = h.mails().filter((m) => m.to === 'supervisora@agencia.test' && m.tag === 'license_update');
    expect(updates.map((m) => m.subject)).toEqual(expect.arrayContaining([expect.stringContaining('approved by the writers'), expect.stringContaining('in negotiation'), expect.stringContaining('issued')]));
    expect(h.mails().some((m) => m.to === W.diego!.email && m.tag === 'license_update' && /emitida/.test(m.subject))).toBe(true);
  });

  it('un rechazo de cualquier autor rechaza la solicitud', async () => {
    const id = await S.catalog.requestLicense(deps, buyer.id, cumbia, { usage: 'videogame', territory: 'WORLD', termMonths: 36, project: 'Videojuego de carreras, menú principal.', oneStop: false }, ctx);
    await S.catalog.decideLicense(deps, W.diego!.id, id, false, ctx);
    const [r] = await deps.db.select().from(t.licenseRequests).where(eq(t.licenseRequests.id, id));
    expect(r!.status).toBe('writers_rejected');
  });

  it('briefs: el comprador publica, un autor Pro envía su obra con un clic y el comprador la recibe', async () => {
    const briefId = await S.catalog.createBrief(deps, buyer.id, { title: 'Cumbia para campaña de verano', description: 'Buscamos cumbia alegre para TV y redes.', moods: ['happy'], genres: ['cumbia'], languages: ['es'], usage: 'digital_ads', territory: 'LATAM', termMonths: 12, budgetMinCents: 200000, budgetMaxCents: 500000, deadline: null }, ctx);
    expect((await S.catalog.openBriefs(deps, W.vale!.id)).some((b) => b.id === briefId)).toBe(true);
    await expect(S.catalog.submitToBrief(deps, W.cami!.id, briefId, cumbia, '', ctx)).rejects.toThrow('PLAN_REQUIRES_PRO');
    await S.catalog.submitToBrief(deps, W.vale!.id, briefId, cumbia, 'Perfecta para la playa.', ctx);
    const mine = await S.catalog.buyerBriefs(deps, buyer.id);
    expect(mine.find((b) => b.id === briefId)!.submissions.map((s) => s.title)).toEqual(['Cumbia del Verano']);
  });
});

describe('catálogo A&R: invitación, interés y hold', () => {
  let ar = { id: '', email: '' };
  let token = '';
  it('solo con invitación: el enlace es personal y vence', async () => {
    const invId = await S.catalog.inviteAr(deps, ops, { email: 'ar@sello.test', company: 'Sello Andino' }, ctx);
    await S.dispatchPending(deps, { limit: 500 });
    const mail = h.mails().find((m) => m.to === 'ar@sello.test' && m.tag === 'ar_invitation')!;
    token = mail.text.match(/\/ar\/invitacion\/(\S+)/)![1]!;
    expect(token.startsWith(invId)).toBe(true);
    expect(await S.catalog.invitationInfo(deps, `${invId}.forjado`)).toBeNull();
    const other = await plainUser('otra@sello.test');
    await expect(S.catalog.acceptArInvitation(deps, other.id, token, ctx)).rejects.toThrow('INVITATION_OTHER_EMAIL');
    ar = await plainUser('ar@sello.test');
    await expect(S.catalog.arCatalog(deps, ar.id)).rejects.toThrow('FORBIDDEN');
    await S.catalog.acceptArInvitation(deps, ar.id, token, ctx);
  });

  it('ve solo obras sin grabar con opt-in A&R, con extracto de letra y sin datos de contacto', async () => {
    const items = await S.catalog.arCatalog(deps, ar.id);
    expect(items.map((i) => i.title)).toEqual(['Cumbia del Verano']);
    expect(JSON.stringify(items)).not.toContain(W.vale!.email);
  });

  it('"me interesa" avisa a los autores; el hold lo aprueba quien registró la obra y bloquea otros', async () => {
    await S.catalog.expressInterest(deps, ar.id, cumbia, 'Para el próximo disco de nuestra artista.', ctx);
    await S.catalog.expressInterest(deps, ar.id, cumbia, 'Duplicado', ctx);
    await S.dispatchPending(deps, { limit: 500 });
    expect(h.mails().filter((m) => m.tag === 'ar_interest' && m.subject.includes('Sello Andino'))).toHaveLength(2);
    await expect(S.catalog.requestHold(deps, ar.id, cumbia, 45, '', ctx)).rejects.toThrow('HOLD_DAYS_INVALID');
    const holdId = await S.catalog.requestHold(deps, ar.id, cumbia, 30, 'Grabamos en noviembre.', ctx);
    await expect(S.catalog.requestHold(deps, ar.id, cumbia, 60, '', ctx)).rejects.toThrow('HOLD_ALREADY_REQUESTED');
    await expect(S.catalog.decideHold(deps, W.diego!.id, holdId, true, '', ctx)).rejects.toThrow('FORBIDDEN');
    await S.catalog.decideHold(deps, W.vale!.id, holdId, true, '', ctx);
    const view = (await S.catalog.arWork(deps, ar.id, cumbia))!;
    expect(view.work.heldUntil).toBeTruthy();
    await S.dispatchPending(deps, { limit: 500 });
    expect(h.mails().some((m) => m.to === 'ar@sello.test' && m.tag === 'hold_decided' && /approved/i.test(m.subject))).toBe(true);
    clock.now = new Date(clock.now.getTime() + 31 * 86_400_000);
    expect((await S.catalog.runCatalogTimers(deps)).holdsExpired).toBe(1);
  });

  it('con la membresía suspendida las obras salen de los catálogos', async () => {
    await deps.db.update(t.works).set({ optInsSuspended: true }).where(eq(t.works.createdBy, W.vale!.id));
    expect(await S.catalog.arCatalog(deps, ar.id)).toHaveLength(0);
    await deps.db.update(t.works).set({ optInsSuspended: false }).where(eq(t.works.createdBy, W.vale!.id));
  });
});
