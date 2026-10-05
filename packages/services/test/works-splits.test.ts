import { afterAll, describe, expect, it } from 'vitest';
import { and, eq, t, sql } from '@pluma/db';
import { makeHarness } from './harness';

const h = makeHarness();
const { S, deps, ctx } = h;
afterAll(() => h.close());

const input = (title: string, isrcs: string[] = []) => ({ title, altTitles: [], language: 'es', genre: 'reggaetón', lyrics: 'Luna que me miras\ncuando nadie ve', aiDeclaration: 'none' as const, isrcs });

async function guestToken(shareId: string) {
  const [s] = await deps.db.select().from(t.splitShares).where(eq(t.splitShares.id, shareId));
  return S.guestSignToken(deps.signingSecret, shareId, new Date(s!.invitedAt!).toISOString());
}

describe('obra con 4 coautores (criterio 2)', () => {
  it('no se envía si no suma 100 %, y no pasa a registro hasta que todos firman', async () => {
    const ana = await h.onboardWriter({ name: 'Ana Ruiz' });
    const bruno = await h.onboardWriter({ name: 'Bruno Díaz', locale: 'en' });
    const workId = await S.createWork(deps, ana.id, input('Luna de Barranquilla', ['CO-A1B-26-00001']), ctx);

    const shares = (last: number) => [
      { kind: 'member' as const, userId: ana.id, role: 'composer_lyricist' as const, bps: 2500 },
      { kind: 'external' as const, name: 'Bruno', email: bruno.email, role: 'composer' as const, bps: 2500 }, // se resuelve a socio
      { kind: 'external' as const, name: 'Carla Gómez', email: 'carla@guest.test', role: 'lyricist' as const, bps: 2500 },
      { kind: 'external' as const, name: 'Darío Peña', email: 'dario@guest.test', role: 'arranger' as const, bps: last },
    ];
    await S.setDraftSplit(deps, ana.id, workId, shares(2499), ctx);
    const err = await S.submitForSignatures(deps, ana.id, workId, ctx).catch((e) => e);
    expect(err.code).toBe('SPLIT_INVALID');
    expect(err.details.remainingBps).toBe(1);
    expect((await deps.db.select().from(t.works).where(eq(t.works.id, workId)))[0]!.status).toBe('draft');

    await S.setDraftSplit(deps, ana.id, workId, shares(2500), ctx);
    const { sheetSha } = await S.submitForSignatures(deps, ana.id, workId, ctx);
    expect(sheetSha).toMatch(/^[0-9a-f]{64}$/);
    let detail = (await S.getWorkDetail(deps, ana.id, workId))!;
    expect(detail.work.status).toBe('awaiting_signatures');
    const v = detail.versions[0]!;
    expect(v.parties.find((p) => p.isMe)!.status).toBe('signed');
    expect(v.parties.filter((p) => p.administered).length).toBe(2); // Ana y Bruno, socios
    // la versión enviada queda congelada
    await expect(S.setDraftSplit(deps, ana.id, workId, shares(2500), ctx)).rejects.toThrow('NO_DRAFT_VERSION');

    // Invitaciones en el idioma de cada quien
    const r = await S.dispatchPending(deps);
    expect(r.failed).toBe(0);
    const mails = h.mails();
    expect(mails.find((m) => m.to === bruno.email && m.tag === 'split_invitation')!.subject).toContain('invited you to sign');
    expect(mails.find((m) => m.to === 'carla@guest.test')!.text).toContain('http://firma.test/t/');
    expect(mails.find((m) => m.to === 'dario@guest.test')).toBeTruthy();

    // Carla firma desde el enlace con código
    const carla = v.parties.find((p) => p.displayName === 'Carla Gómez')!;
    const carlaToken = await guestToken(carla.shareId);
    expect((await S.getGuestInvitation(deps, carlaToken))!.state).toBe('open');
    await S.sendGuestCode(deps, carlaToken, 'es');
    await expect(S.signAsGuest(deps, carlaToken, '123456', ctx)).rejects.toThrow(/CODE_INVALID/);
    await S.signAsGuest(deps, carlaToken, h.lastCodeFor('carla@guest.test'), ctx);
    expect((await S.getGuestInvitation(deps, carlaToken))!.state).toBe('signed');

    // Bruno (socio) firma en la app
    const brunoShare = v.parties.find((p) => p.displayName === 'Bruno Díaz')!;
    await expect(S.signAsMember(deps, ana.id, brunoShare.shareId, ctx)).rejects.toThrow('FORBIDDEN');
    await S.signAsMember(deps, bruno.id, brunoShare.shareId, ctx);
    detail = (await S.getWorkDetail(deps, ana.id, workId))!;
    expect(detail.work.status).toBe('awaiting_signatures'); // falta Darío

    const dario = v.parties.find((p) => p.displayName === 'Darío Peña')!;
    const darioToken = await guestToken(dario.shareId);
    await S.sendGuestCode(deps, darioToken, 'es');
    await S.signAsGuest(deps, darioToken, h.lastCodeFor('dario@guest.test'), ctx);

    detail = (await S.getWorkDetail(deps, ana.id, workId))!;
    expect(detail.work.status).toBe('splits_signed');
    expect(detail.versions[0]!.status).toBe('signed');
    expect(detail.versions[0]!.effectiveFrom).toBe('2026-10-05');

    // 4 firmas sobre el mismo documento, con evidencia
    const sigs = await deps.db.select().from(t.signatures).where(and(eq(t.signatures.documentKind, 'split_sheet'), eq(t.signatures.documentRef, v.id)));
    expect(sigs).toHaveLength(4);
    expect(new Set(sigs.map((s) => s.documentSha256))).toEqual(new Set([sheetSha]));
    expect(sigs.map((s) => s.method).sort()).toEqual(['link+otp', 'link+otp', 'session', 'session']);

    // Auditoría de cada acción sobre splits (criterio 7)
    const audit = await deps.db.execute<{ command: string }>(sql`select distinct command from audit_log where entity_type in ('split_shares', 'split_versions') and command is not null`);
    expect(audit.map((a) => a.command)).toEqual(expect.arrayContaining(['split.edit_draft', 'split.submit', 'split.sign', 'split.sign_guest']));

    await S.dispatchPending(deps);
    expect(h.mails().filter((m) => m.tag === 'split_completed')).toHaveLength(4);

    // Back-office: exportación a Chappell y registro
    const ops = await h.onboardWriter({ name: 'Operadora' });
    await deps.db.insert(t.userRoles).values({ userId: ops.id, role: 'operator' });
    const exp = (await S.admin.exportNewWorks(deps, ops.id, ctx))!;
    expect(exp.csv.split('\n').filter((l) => l.includes(workId))).toHaveLength(4);
    expect(exp.csv).toContain('Carla Gómez');
    await S.admin.registerWork(deps, ops.id, workId, { chappellWorkCode: 'WCM-000123', iswc: 'T-034.524.680-1' }, ctx);
    detail = (await S.getWorkDetail(deps, bruno.id, workId))!;
    expect(detail.work.status).toBe('registered');
    expect(detail.history.map((x) => x.toStatus)).toEqual(['draft', 'awaiting_signatures', 'splits_signed', 'sent_to_publisher', 'registered']);
  });

  it('un reclamo lleva la obra a "En disputa" y el operador abre una nueva versión', async () => {
    const ana = await h.onboardWriter();
    const workId = await S.createWork(deps, ana.id, input('Canción en disputa'), ctx);
    await S.setDraftSplit(deps, ana.id, workId, [
      { kind: 'member', userId: ana.id, role: 'composer_lyricist', bps: 7000 },
      { kind: 'external', name: 'Eva', email: 'eva@guest.test', role: 'lyricist', bps: 3000 },
    ], ctx);
    await S.submitForSignatures(deps, ana.id, workId, ctx);
    const detail = (await S.getWorkDetail(deps, ana.id, workId))!;
    const eva = detail.versions[0]!.parties.find((p) => !p.isMe)!;
    const token = await guestToken(eva.shareId);
    await S.sendGuestCode(deps, token, 'es');
    await S.rejectAsGuest(deps, token, h.lastCodeFor('eva@guest.test'), 'Escribí la mitad de la letra, no el 30 %', ctx);
    const after = (await S.getWorkDetail(deps, ana.id, workId))!;
    expect(after.work.status).toBe('disputed');
    expect(after.disputes[0]!.reason).toContain('mitad');

    const ops = await h.onboardWriter();
    await deps.db.insert(t.userRoles).values({ userId: ops.id, role: 'operator' });
    await S.admin.resolveDispute(deps, ops.id, after.disputes[0]!.id, { outcome: 'new_version', resolution: 'Acordaron 50/50 por teléfono' }, ctx);
    const resolved = (await S.getWorkDetail(deps, ana.id, workId))!;
    expect(resolved.work.status).toBe('draft');
    expect(resolved.versions[0]!.status).toBe('draft');
    expect(resolved.versions[0]!.version).toBe(2);
    await S.setDraftSplit(deps, ana.id, workId, [
      { kind: 'member', userId: ana.id, role: 'composer_lyricist', bps: 5000 },
      { kind: 'external', name: 'Eva', email: 'eva@guest.test', role: 'lyricist', bps: 5000 },
    ], ctx);
    await S.submitForSignatures(deps, ana.id, workId, ctx);
    expect((await S.getWorkDetail(deps, ana.id, workId))!.work.status).toBe('awaiting_signatures');
  });

  it('cambiar splits de una obra firmada exige nueva firma de todos y la versión vigente no cambia hasta entonces', async () => {
    const ana = await h.onboardWriter();
    const workId = await S.createWork(deps, ana.id, input('Solo mía'), ctx);
    await S.submitForSignatures(deps, ana.id, workId, ctx); // 100 % propia: queda firmada al enviar
    expect((await S.getWorkDetail(deps, ana.id, workId))!.work.status).toBe('splits_signed');
    await S.proposeNewVersion(deps, ana.id, workId, 'Agrego a un productor', ctx);
    await S.setDraftSplit(deps, ana.id, workId, [
      { kind: 'member', userId: ana.id, role: 'composer_lyricist', bps: 8000 },
      { kind: 'external', name: 'Prod', email: 'prod@guest.test', role: 'composer', bps: 2000 },
    ], ctx);
    await S.submitForSignatures(deps, ana.id, workId, ctx);
    const d = (await S.getWorkDetail(deps, ana.id, workId))!;
    expect(d.work.status).toBe('splits_signed');
    expect(d.versions.map((v) => [v.version, v.status])).toEqual([[2, 'pending_signatures'], [1, 'signed']]);
  });

  it('recordatorio a los 3 días y disputa automática si vence sin firma', async () => {
    const ana = await h.onboardWriter();
    const workId = await S.createWork(deps, ana.id, input('Sin respuesta'), ctx);
    await S.setDraftSplit(deps, ana.id, workId, [
      { kind: 'member', userId: ana.id, role: 'composer_lyricist', bps: 5000 },
      { kind: 'external', name: 'Fer', email: 'fer@guest.test', role: 'lyricist', bps: 5000 },
    ], ctx);
    await S.submitForSignatures(deps, ana.id, workId, ctx);
    await S.dispatchPending(deps);
    h.clock.now = new Date('2026-10-08T16:00:00Z');
    expect((await S.runSplitJobs(deps)).reminded).toBeGreaterThanOrEqual(1);
    await S.dispatchPending(deps);
    expect(h.mails().some((m) => m.to === 'fer@guest.test' && m.tag === 'split_reminder')).toBe(true);
    h.clock.now = new Date('2026-10-20T16:00:00Z');
    expect((await S.runSplitJobs(deps)).expired).toBeGreaterThanOrEqual(1);
    expect((await S.getWorkDetail(deps, ana.id, workId))!.work.status).toBe('disputed');
    h.clock.now = new Date('2026-10-05T15:00:00Z');
  });

  it('alerta de conflicto cuando otra persona registra título e ISRC similares', async () => {
    const a = await h.onboardWriter();
    const b = await h.onboardWriter();
    const w1 = await S.createWork(deps, a.id, input('Corazón de Papel', ['US-ABC-26-00042']), ctx);
    await S.submitForSignatures(deps, a.id, w1, ctx);
    const w2 = await S.createWork(deps, b.id, input('CORAZON DE PAPEL (feat. Otro)', ['US-ABC-26-00042']), ctx);
    await S.submitForSignatures(deps, b.id, w2, ctx);
    const d = (await S.getWorkDetail(deps, b.id, w2))!;
    expect(d.conflicts).toHaveLength(1);
    expect(d.conflicts[0]!.reason).toBe('title_isrc');
    // RLS: el otro autor no ve la obra ajena
    expect(await S.getWorkDetail(deps, b.id, w1)).toBeNull();
  });
});
