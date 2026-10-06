import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, t } from '@pluma/db';
import { makeHarness } from './harness';

const h = makeHarness();
const { S, deps, ctx, clock } = h;
afterAll(() => h.close());

/** WAV de 1 s (tono de 440 Hz) para probar la carga y la marca de agua. */
function wav(seconds = 1) {
  const sr = 8000;
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
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / sr)), 44 + i * 2);
  return b;
}

const base = { type: 'beat_seeks_topliner', title: 'Dembow a 100 BPM', description: 'Tengo el beat listo, busco topliner con melodía pegajosa.', genre: 'Dembow', languages: ['es'], bpm: 100, city: null, modality: 'remote', offeredShareBps: 4000 };
const W: Record<string, { id: string; email: string }> = {};
let ops = '';
let requestId = '';
let applicationId = '';
let collaborationId = '';

beforeAll(async () => {
  W.diego = await h.onboardWriter({ plan: 'socio', name: 'Diego Morales' });
  W.sam = await h.onboardWriter({ plan: 'pro', name: 'Sam Rivera', locale: 'en' });
  W.vale = await h.onboardWriter({ plan: 'pro', name: 'Vale Ríos' });
  W.cami = await h.onboardWriter({ plan: 'socio', name: 'Cami Duarte', locale: 'pt-BR' });
  ops = (await h.onboardWriter({ name: 'Operadora' })).id;
  await deps.db.insert(t.userRoles).values({ userId: ops, role: 'operator' });
  await S.dispatchPending(deps, { limit: 500 });
});

describe('criterio 5: de una solicitud a una obra con splits firmados', () => {
  it('Diego publica con demo protegido; los perfiles Pro aparecen destacados primero', async () => {
    requestId = await S.network.createRequest(deps, W.diego!.id, base, { bytes: wav(), mime: 'audio/wav' }, ctx);
    await S.network.createRequest(deps, W.vale!.id, { ...base, type: 'seeks_producer', title: 'Busco productor de cumbia', genre: 'Cumbia', offeredShareBps: 3000 }, null, ctx);
    const b = await S.network.board(deps, W.sam!.id);
    expect(b[0]!.featured).toBe(true);
    expect(b[0]!.authorName).toBe('Vale Ríos');
    const mine = b.find((x) => x.id === requestId)!;
    expect(mine).toMatchObject({ featured: false, hasDemo: true, offeredShareBps: 4000 });
    expect((await S.network.board(deps, W.sam!.id, { type: 'seeks_producer' })).every((x) => x.type === 'seeks_producer')).toBe(true);
    expect((await S.network.board(deps, W.sam!.id, { genre: 'dembow' })).map((x) => x.id)).toEqual([requestId]);
  });

  it('el demo solo se escucha dentro de Pluma, con URL de 60 s y cada escucha registrada', async () => {
    const [r] = await deps.db.select().from(t.networkRequests).where(eq(t.networkRequests.id, requestId));
    const play = await S.authorizePlay(deps, W.sam!.id, r!.demoFileId!, '203.0.113.9');
    expect(play?.url).toMatch(/dev-storage/);
    const plays = await deps.db.select().from(t.audioPlays).where(eq(t.audioPlays.fileId, r!.demoFileId!));
    expect(plays).toHaveLength(1);
    expect(plays[0]!.ipHash).toMatch(/^[0-9a-f]{64}$/);
    const [f] = await deps.db.select().from(t.workFiles).where(eq(t.workFiles.id, r!.demoFileId!));
    expect(f!.kind).toBe('network_demo_preview');
    // Con ffmpeg instalado, la versión de escucha lleva marca de agua; el original nunca se sirve.
    const [orig] = await deps.db.select().from(t.workFiles).where(and(eq(t.workFiles.ownerUserId, W.diego!.id), eq(t.workFiles.kind, 'network_demo_original')));
    expect(await S.authorizePlay(deps, W.sam!.id, orig!.id, null)).toBeNull();
  });

  it('postularse exige aceptar el split ofrecido y no permite postular dos veces ni a lo propio', async () => {
    await expect(S.network.apply(deps, W.sam!.id, requestId, { message: 'Tengo una melodía perfecta para esto.', acceptShare: false, sample: null }, ctx)).rejects.toThrow('SPLIT_NOT_ACCEPTED');
    await expect(S.network.apply(deps, W.diego!.id, requestId, { message: 'Me postulo a mí mismo.', acceptShare: true, sample: null }, ctx)).rejects.toThrow('OWN_REQUEST');
    applicationId = await S.network.apply(deps, W.sam!.id, requestId, { message: 'Tengo una melodía perfecta para esto.', acceptShare: true, sample: { bytes: wav(), mime: 'audio/wav' } }, ctx);
    await expect(S.network.apply(deps, W.sam!.id, requestId, { message: 'Otra vez, por si acaso.', acceptShare: true, sample: null }, ctx)).rejects.toThrow('ALREADY_APPLIED');
    await S.network.apply(deps, W.vale!.id, requestId, { message: 'Yo también quiero escribir este tema.', acceptShare: true, sample: null }, ctx);
  });

  it('quien publicó recibe la tarjeta del postulante sin su correo ni teléfono; el postulante, la confirmación', async () => {
    await S.dispatchPending(deps, { limit: 500 });
    const received = h.mails().filter((m) => m.to === W.diego!.email && m.tag === 'application_received');
    expect(received).toHaveLength(2);
    const card = received.find((m) => m.subject.includes('Sam Rivera'))!;
    expect(card.text).toContain('Tengo una melodía perfecta');
    expect(card.text).toContain('40');
    expect(card.text).not.toContain(W.sam!.email);
    expect(h.mails().some((m) => m.to === W.sam!.email && m.tag === 'application_sent' && /You applied/.test(m.subject))).toBe(true);
    const detail = (await S.network.getRequest(deps, W.diego!.id, requestId))!;
    expect(detail.applications).toHaveLength(2);
    expect(JSON.stringify(detail)).not.toContain(W.sam!.email);
    // La muestra de la postulación la escucha quien publicó, nadie más.
    const sample = detail.applications.find((a) => a.userId === W.sam!.id)!.sampleFileId!;
    expect(await S.authorizePlay(deps, W.diego!.id, sample, null)).not.toBeNull();
    expect(await S.authorizePlay(deps, W.cami!.id, sample, null)).toBeNull();
  });

  it('al aceptar: split pre-acordado, contactos revelados, solicitud cubierta y los demás avisados', async () => {
    await expect(S.network.getCollaboration(deps, W.sam!.id, '00000000-0000-0000-0000-000000000000')).resolves.toBeNull();
    collaborationId = await S.network.acceptApplication(deps, W.diego!.id, applicationId, ctx);
    const c = (await S.network.getCollaboration(deps, W.sam!.id, collaborationId))!;
    expect(c.parties.map((p) => [p.name, p.role, p.shareBps])).toEqual([
      ['Diego Morales', 'composer', 6000],
      ['Sam Rivera', 'composer_lyricist', 4000],
    ]);
    expect(c.parties.find((p) => !p.isMe)!.email).toBe(W.diego!.email);
    expect(await S.network.getCollaboration(deps, W.cami!.id, collaborationId)).toBeNull();
    const [r] = await deps.db.select().from(t.networkRequests).where(eq(t.networkRequests.id, requestId));
    expect(r!.status).toBe('filled');
    await S.dispatchPending(deps, { limit: 500 });
    const accepted = h.mails().filter((m) => m.tag === 'application_accepted');
    expect(accepted.find((m) => m.to === W.sam!.email)!.text).toContain(W.diego!.email);
    expect(accepted.find((m) => m.to === W.diego!.email)!.text).toContain(W.sam!.email);
    expect(h.mails().some((m) => m.to === W.vale!.email && m.tag === 'application_declined')).toBe(true);
    expect((await S.network.board(deps, W.cami!.id)).some((x) => x.id === requestId)).toBe(false);
  });

  it('cerrar canción crea la obra con ese split; con la firma de ambos queda lista para registro', async () => {
    await S.network.setSessionUrl(deps, W.sam!.id, collaborationId, 'https://meet.example.com/sesion', ctx);
    await expect(S.network.setSessionUrl(deps, W.sam!.id, collaborationId, 'ftp://x', ctx)).rejects.toThrow('SESSION_URL_INVALID');
    const workId = await S.network.closeSong(deps, W.sam!.id, collaborationId, { title: 'Dembow del Malecón' }, ctx);
    await expect(S.network.closeSong(deps, W.diego!.id, collaborationId, {}, ctx)).rejects.toThrow('COLLABORATION_CLOSED');
    let d = (await S.getWorkDetail(deps, W.sam!.id, workId))!;
    expect(d.work.title).toBe('Dembow del Malecón');
    expect(d.work.status).toBe('awaiting_signatures');
    const diegoShare = d.versions[0]!.parties.find((p) => !p.isMe)!;
    await S.dispatchPending(deps, { limit: 500 });
    expect(h.mails().some((m) => m.to === W.diego!.email && m.tag === 'split_invitation')).toBe(true);
    await S.signAsMember(deps, W.diego!.id, diegoShare.shareId, ctx);
    d = (await S.getWorkDetail(deps, W.sam!.id, workId))!;
    expect(d.work.status).toBe('splits_signed');
    expect((await S.network.getCollaboration(deps, W.diego!.id, collaborationId))!.workId).toBe(workId);
    // La obra firmada ya cuenta como crédito verificado (registro de Pluma).
    const card = await S.profiles.publicCard(deps, W.sam!.id);
    expect(card.credits.map((x) => x.title)).toContain('Dembow del Malecón');
    expect(card.history.collaborations).toBe(1);
  });
});

describe('cupo diario y tiempos', () => {
  it('Socio: 3 postulaciones en 24 h; la cuarta se bloquea hasta que se libera un cupo', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push(await S.network.createRequest(deps, W.vale!.id, { ...base, title: `Solicitud de prueba ${i}` }, null, ctx));
    for (let i = 0; i < 3; i++) await S.network.apply(deps, W.cami!.id, ids[i]!, { message: 'Quero participar dessa faixa!', acceptShare: true, sample: null }, ctx);
    const err = await S.network.apply(deps, W.cami!.id, ids[3]!, { message: 'Quero participar dessa faixa!', acceptShare: true, sample: null }, ctx).catch((e) => e);
    expect(err.code).toBe('DAILY_LIMIT');
    expect(err.details.nextSlotAt).toBeTruthy();
    clock.now = new Date(clock.now.getTime() + 25 * 3_600_000);
    await S.network.apply(deps, W.cami!.id, ids[3]!, { message: 'Quero participar dessa faixa!', acceptShare: true, sample: null }, ctx);
  });

  it('a las 72 h se recuerda a quien publicó (una vez) y a los 7 días la postulación vence', async () => {
    await S.dispatchPending(deps, { limit: 500 });
    clock.now = new Date(clock.now.getTime() + 49 * 3_600_000); // 74 h desde las tres primeras
    const r1 = await S.network.runNetworkTimers(deps);
    expect(r1.reminded).toBe(3);
    expect((await S.network.runNetworkTimers(deps)).reminded).toBe(0);
    await S.dispatchPending(deps, { limit: 500 });
    expect(h.mails().filter((m) => m.to === W.vale!.email && m.tag === 'application_reminder')).toHaveLength(3);
    clock.now = new Date(clock.now.getTime() + 5 * 86_400_000);
    const r2 = await S.network.runNetworkTimers(deps);
    expect(r2.expired).toBeGreaterThanOrEqual(3);
    await S.dispatchPending(deps, { limit: 500 });
    expect(h.mails().filter((m) => m.to === W.cami!.email && m.tag === 'application_expired').length).toBeGreaterThanOrEqual(3);
  });

  it('con la membresía suspendida no hay red; los menores tampoco aparecen', async () => {
    await deps.db.update(t.memberships).set({ status: 'suspended' }).where(eq(t.memberships.userId, W.cami!.id));
    await expect(S.network.board(deps, W.cami!.id).then(() => S.network.apply(deps, W.cami!.id, requestId, { message: 'Quero participar dessa faixa!', acceptShare: true, sample: null }, ctx))).rejects.toThrow('MEMBERSHIP_INACTIVE');
    await deps.db.update(t.writerProfiles).set({ birthDate: '2013-01-01' }).where(eq(t.writerProfiles.userId, W.sam!.id));
    await expect(S.network.createRequest(deps, W.sam!.id, base, null, ctx)).rejects.toThrow('NETWORK_MINOR');
    expect(await S.profiles.publicProfile(deps, W.vale!.id, W.sam!.id)).toBeNull();
    await deps.db.update(t.writerProfiles).set({ birthDate: '1993-11-21' }).where(eq(t.writerProfiles.userId, W.sam!.id));
  });
});

describe('moderación y créditos (E16)', () => {
  it('un operador oculta una solicitud: sale del tablero y queda auditado', async () => {
    const id = await S.network.createRequest(deps, W.vale!.id, { ...base, title: 'Solicitud con spam' }, null, ctx);
    await expect(S.profiles.setRequestHidden(deps, ops, id, true, 'x', ctx)).rejects.toThrow('REASON_REQUIRED');
    await S.profiles.setRequestHidden(deps, ops, id, true, 'Contenido promocional', ctx);
    expect((await S.network.board(deps, W.diego!.id)).some((x) => x.id === id)).toBe(false);
    expect(await S.network.getRequest(deps, W.diego!.id, id)).toBeNull();
    expect((await S.profiles.listRequestsAdmin(deps, ops, { hidden: true })).some((x) => x.id === id)).toBe(true);
    await expect(S.profiles.setRequestHidden(deps, W.vale!.id, id, false, '', ctx)).rejects.toThrow('FORBIDDEN');
  });

  it('un crédito declarado aparece en la tarjeta solo cuando un operador lo verifica', async () => {
    await S.profiles.updateNetworkProfile(deps, W.vale!.id, { bio: 'Compositora de Medellín.', languages: ['es', 'en'], mainRole: 'composer_lyricist', dspLinks: { spotify: 'https://open.spotify.com/artist/x' } }, ctx);
    await expect(S.profiles.updateNetworkProfile(deps, W.vale!.id, { bio: '', languages: [], mainRole: null, dspLinks: { spotify: 'javascript:alert(1)' } }, ctx)).rejects.toThrow('URL_INVALID');
    await S.profiles.addCredit(deps, W.vale!.id, { title: 'Noche de Luna', artist: 'Karol Ficticia', role: 'Compositora', dspUrl: 'https://open.spotify.com/track/y' }, ctx);
    expect((await S.profiles.publicCard(deps, W.vale!.id)).credits.some((c) => c.title === 'Noche de Luna')).toBe(false);
    const [pending] = (await S.profiles.pendingCredits(deps, ops)).filter((c) => c.title === 'Noche de Luna');
    await S.profiles.reviewCredit(deps, ops, pending!.id, true, '', ctx);
    const card = await S.profiles.publicCard(deps, W.vale!.id);
    expect(card.credits[0]).toMatchObject({ title: 'Noche de Luna', source: 'operator' });
    expect(card).toMatchObject({ mainRole: 'composer_lyricist', languages: ['es', 'en'] });
  });
});
