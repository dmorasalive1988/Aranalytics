import { eq, t } from '@pluma/db';
import type { ShareInput } from '../src';
import type { makeHarness } from './harness';

type H = ReturnType<typeof makeHarness>;

/** Registra una obra con todos sus splits firmados (los invitados firman por enlace + código). */
export async function signedWork(h: H, ownerId: string, title: string, shares: ShareInput[], opts: { code?: string; iswc?: string; opsId?: string } = {}) {
  const { S, deps, ctx } = h;
  const workId = await S.createWork(deps, ownerId, { title, altTitles: [], language: 'es', genre: 'pop', lyrics: null, aiDeclaration: 'none', isrcs: [] }, ctx);
  await S.setDraftSplit(deps, ownerId, workId, shares, ctx);
  await S.submitForSignatures(deps, ownerId, workId, ctx);
  const d = (await S.getWorkDetail(deps, ownerId, workId))!;
  for (const p of d.versions[0]!.parties.filter((x) => x.status === 'pending')) {
    const [share] = await deps.db.select().from(t.splitShares).where(eq(t.splitShares.id, p.shareId));
    if (share!.writerUserId) await S.signAsMember(deps, share!.writerUserId, share!.id, ctx);
    else {
      const token = S.guestSignToken(deps.signingSecret, share!.id, new Date(share!.invitedAt!).toISOString());
      await S.sendGuestCode(deps, token, 'es');
      await S.signAsGuest(deps, token, h.lastCodeFor(share!.externalEmail!), ctx);
    }
  }
  if (opts.code && opts.opsId) {
    await S.admin.exportNewWorks(deps, opts.opsId, ctx);
    await S.admin.registerWork(deps, opts.opsId, workId, { publisherWorkCode: opts.code, iswc: opts.iswc ?? null }, ctx);
  }
  return workId;
}
