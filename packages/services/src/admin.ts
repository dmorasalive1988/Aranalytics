import { and, desc, eq, ilike, inArray, isNull, ne, or, t, withSystem, sql, type Tx } from '@pluma/db';
import { DomainError, isValidIswc, normalizeIswc, type PlanCode, type WorkStatus } from '@pluma/domain';
import { sha256 } from './crypto';
import type { Deps, RequestCtx } from './deps';
import { emit } from './events';
import { partiesFor } from './works';

export type StaffRole = 'operator' | 'approver' | 'super_admin';

export async function staffRoles(deps: Deps, userId: string): Promise<StaffRole[]> {
  const rows = await deps.db.select({ role: t.userRoles.role }).from(t.userRoles).where(eq(t.userRoles.userId, userId));
  return rows.map((r) => r.role).filter((r): r is StaffRole => r === 'operator' || r === 'approver' || r === 'super_admin');
}

async function requireStaff(deps: Deps, userId: string, allowed: StaffRole[]) {
  const roles = await staffRoles(deps, userId);
  if (!roles.some((r) => allowed.includes(r))) throw new DomainError('FORBIDDEN');
  return roles;
}

const staffCtx = (userId: string, role: StaffRole, command: string, ctx: RequestCtx) => ({ actorId: userId, actorRole: role, command, ...ctx });

/* --------------------------------- Autores -------------------------------- */

export async function listAuthors(deps: Deps, staffId: string, q = '') {
  await requireStaff(deps, staffId, ['operator', 'approver', 'super_admin']);
  const like = `%${q.trim()}%`;
  return deps.db
    .select({ id: t.users.id, email: t.users.email, legalName: t.writerProfiles.legalName, artistName: t.writerProfiles.artistName, country: t.writerProfiles.country, society: t.writerProfiles.societyCode, plan: t.memberships.planCode, status: t.memberships.status, kyc: t.users.kycStatus, createdAt: t.users.createdAt })
    .from(t.users)
    .innerJoin(t.writerProfiles, eq(t.writerProfiles.userId, t.users.id))
    .leftJoin(t.memberships, eq(t.memberships.userId, t.users.id))
    .where(q ? or(ilike(t.writerProfiles.legalName, like), ilike(t.writerProfiles.artistName, like), ilike(sql`${t.users.email}::text`, like)) : undefined)
    .orderBy(desc(t.users.createdAt))
    .limit(200);
}

export async function getAuthor(deps: Deps, staffId: string, userId: string) {
  await requireStaff(deps, staffId, ['operator', 'approver', 'super_admin']);
  const db = deps.db;
  const [user] = await db.select().from(t.users).where(eq(t.users.id, userId));
  if (!user) return null;
  const [[profile], [membership], periods, payments, agreements, works, guardians, balance] = await Promise.all([
    db.select().from(t.writerProfiles).where(eq(t.writerProfiles.userId, userId)),
    db.select().from(t.memberships).where(eq(t.memberships.userId, userId)),
    db.select().from(t.membershipPlanPeriods).where(eq(t.membershipPlanPeriods.userId, userId)).orderBy(desc(t.membershipPlanPeriods.validFrom)),
    db.select().from(t.membershipPayments).where(eq(t.membershipPayments.userId, userId)).orderBy(desc(t.membershipPayments.occurredAt)),
    db.select({ id: t.agreements.id, acceptedAt: t.agreements.acceptedAt, version: t.legalDocuments.version, locale: t.legalDocuments.locale, method: t.signatures.method, signer: t.signatures.signerName, ip: t.signatures.ip, sha: t.signatures.documentSha256 })
      .from(t.agreements).innerJoin(t.legalDocuments, eq(t.legalDocuments.id, t.agreements.legalDocumentId)).innerJoin(t.signatures, eq(t.signatures.id, t.agreements.signatureId)).where(eq(t.agreements.userId, userId)),
    db.select({ id: t.works.id, title: t.works.title, status: t.works.status, createdAt: t.works.createdAt }).from(t.works).where(eq(t.works.createdBy, userId)).orderBy(desc(t.works.createdAt)),
    db.select().from(t.guardians).where(eq(t.guardians.writerUserId, userId)),
    db.select().from(t.writerBalances).where(eq(t.writerBalances.writerUserId, userId)),
  ]);
  return { user, profile, membership, periods, payments, agreements, works, guardians, balance };
}

export async function setKycStatus(deps: Deps, staffId: string, userId: string, status: 'approved' | 'rejected' | 'needs_review', ctx: RequestCtx) {
  const roles = await requireStaff(deps, staffId, ['operator', 'super_admin']);
  await withSystem(deps.db, staffCtx(staffId, roles[0]!, 'kyc.review', ctx), async (tx) => {
    await tx.update(t.users).set({ kycStatus: status }).where(eq(t.users.id, userId));
    await tx.insert(t.kycChecks).values({ userId, provider: 'manual', providerRef: `staff:${staffId}`, status });
  });
}

/* ---------------------------------- Obras --------------------------------- */

export async function listWorksAdmin(deps: Deps, staffId: string, filter: { status?: WorkStatus; q?: string } = {}) {
  await requireStaff(deps, staffId, ['operator', 'approver', 'super_admin']);
  const conds = [];
  if (filter.status) conds.push(eq(t.works.status, filter.status));
  if (filter.q) conds.push(or(ilike(t.works.title, `%${filter.q}%`), eq(t.works.publisherWorkCode, filter.q), eq(t.works.iswc, filter.q)));
  return deps.db
    .select({ id: t.works.id, title: t.works.title, status: t.works.status, iswc: t.works.iswc, publisherWorkCode: t.works.publisherWorkCode, createdAt: t.works.createdAt, updatedAt: t.works.updatedAt, owner: t.writerProfiles.legalName, ownerId: t.works.createdBy })
    .from(t.works)
    .innerJoin(t.writerProfiles, eq(t.writerProfiles.userId, t.works.createdBy))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(t.works.updatedAt))
    .limit(300);
}

async function setWorkStatus(tx: Tx, workId: string, to: WorkStatus, actorId: string, note: string) {
  const [w] = await tx.select().from(t.works).where(eq(t.works.id, workId));
  if (!w || w.status === to) return;
  await tx.update(t.works).set({ status: to }).where(eq(t.works.id, workId));
  await tx.insert(t.workStatusHistory).values({ workId, fromStatus: w.status, toStatus: to, actorId, note });
  await emit(tx, 'work.status_changed', 'work', workId, { from: w.status, to });
}

const CWR_ROLE: Record<string, string> = { composer: 'C', lyricist: 'A', composer_lyricist: 'CA', arranger: 'AR', translator: 'TR' };
const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Exportación de obras nuevas para alta ante el administrador asociado o las sociedades (E13).
 * CSV provisional de una fila por autor con roles CWR; el formato definitivo lo fija cada destino.
 */
export async function exportNewWorks(deps: Deps, staffId: string, ctx: RequestCtx) {
  const roles = await requireStaff(deps, staffId, ['operator', 'super_admin']);
  const works = await deps.db.select().from(t.works).where(eq(t.works.status, 'splits_signed')).orderBy(t.works.createdAt);
  if (!works.length) return null;
  const header = ['pluma_work_id', 'title', 'alt_titles', 'language', 'iswc', 'isrcs', 'writer_name', 'writer_ipi', 'writer_society', 'role', 'share_pct', 'controlled', 'split_version', 'split_sheet_sha256'];
  const lines = [header.join(',')];
  for (const w of works) {
    const [v] = await deps.db.select().from(t.splitVersions).where(and(eq(t.splitVersions.workId, w.id), eq(t.splitVersions.status, 'signed')));
    if (!v) continue;
    const shares = await deps.db.select().from(t.splitShares).where(eq(t.splitShares.splitVersionId, v.id));
    const parties = await deps.db.transaction((tx) => partiesFor(tx, shares));
    const isrcs = (await deps.db.select({ isrc: t.recordings.isrc }).from(t.recordings).where(eq(t.recordings.workId, w.id))).map((r) => r.isrc).join('|');
    for (const p of parties) {
      lines.push([w.id, w.title, w.altTitles.join('|'), w.language, w.iswc ?? '', isrcs, p.name, p.ipi ?? '', p.society ?? '', CWR_ROLE[p.share.role] ?? p.share.role, (p.share.shareBps / 100).toFixed(2), p.share.administered ? 'Y' : 'N', v.version, v.splitSheetSha256 ?? ''].map(csvCell).join(','));
    }
  }
  const csv = lines.join('\n') + '\n';
  const hash = sha256(csv);
  const path = `registration-exports/${deps.now().toISOString().slice(0, 10)}-${hash.slice(0, 12)}.csv`;
  await deps.storage.putOnce('documents', path, Buffer.from(csv), 'text/csv').catch((e: Error) => {
    if (e.message !== 'OBJECT_EXISTS') throw e;
  });
  const ids = works.map((w) => w.id);
  const submissionId = await withSystem(deps.db, staffCtx(staffId, roles[0]!, 'publisher.export_new_works', ctx), async (tx) => {
    const [s] = await tx.insert(t.publisherSubmissions).values({ provider: 'primary_administrator', filePath: `documents/${path}`, sha256: hash, workIds: ids, createdBy: staffId, sentAt: deps.now().toISOString() }).returning({ id: t.publisherSubmissions.id });
    for (const id of ids) await setWorkStatus(tx, id, 'sent_to_publisher', staffId, `exportación ${path}`);
    return s!.id;
  });
  return { submissionId, csv, fileName: path.split('/').pop()!, count: ids.length };
}

/** Marca la obra como registrada con el código de obra del administrador (clave del matching de statements). */
export async function registerWork(deps: Deps, staffId: string, workId: string, input: { publisherWorkCode: string; iswc: string | null }, ctx: RequestCtx) {
  const roles = await requireStaff(deps, staffId, ['operator', 'super_admin']);
  const code = input.publisherWorkCode.trim();
  if (!code) throw new DomainError('PUBLISHER_CODE_REQUIRED');
  if (input.iswc && !isValidIswc(input.iswc)) throw new DomainError('ISWC_INVALID');
  await withSystem(deps.db, staffCtx(staffId, roles[0]!, 'work.register', ctx), async (tx) => {
    const [w] = await tx.select().from(t.works).where(eq(t.works.id, workId));
    if (!w) throw new DomainError('WORK_NOT_FOUND');
    if (w.status !== 'sent_to_publisher' && w.status !== 'registered') throw new DomainError('WORK_NOT_SENT');
    const iswc = input.iswc ? normalizeIswc(input.iswc) : null;
    const [taken] = await tx.select({ id: t.works.id }).from(t.works).where(and(ne(t.works.id, workId), or(eq(t.works.publisherWorkCode, code), iswc ? eq(t.works.iswc, iswc) : sql`false`)));
    if (taken) throw new DomainError('WORK_CODE_TAKEN');
    await tx.update(t.works).set({ publisherWorkCode: code, iswc: input.iswc ? normalizeIswc(input.iswc) : w.iswc }).where(eq(t.works.id, workId));
    await setWorkStatus(tx, workId, 'registered', staffId, `código de obra ${code}`);
  });
}

/* ------------------------------ Disputas y conflictos ----------------------------- */

export async function listDisputes(deps: Deps, staffId: string) {
  await requireStaff(deps, staffId, ['operator', 'approver', 'super_admin']);
  return deps.db
    .select({ id: t.disputes.id, workId: t.disputes.workId, title: t.works.title, reason: t.disputes.reason, status: t.disputes.status, raisedByEmail: t.disputes.raisedByEmail, openedAt: t.disputes.openedAt, resolution: t.disputes.resolution })
    .from(t.disputes)
    .innerJoin(t.works, eq(t.works.id, t.disputes.workId))
    .orderBy(desc(t.disputes.openedAt))
    .limit(200);
}

/**
 * Resolver una disputa (E14).
 * - new_version: se abre una versión nueva en borrador para que el creador corrija y todos vuelvan a firmar.
 * - reinvite: se reenvían invitaciones (p. ej. el coautor no alcanzó a firmar a tiempo).
 */
export async function resolveDispute(deps: Deps, staffId: string, disputeId: string, input: { outcome: 'new_version' | 'reinvite'; resolution: string }, ctx: RequestCtx) {
  const roles = await requireStaff(deps, staffId, ['operator', 'super_admin']);
  if (input.resolution.trim().length < 5) throw new DomainError('RESOLUTION_REQUIRED');
  await withSystem(deps.db, staffCtx(staffId, roles[0]!, `dispute.resolve.${input.outcome}`, ctx), async (tx) => {
    const [d] = await tx.select().from(t.disputes).where(eq(t.disputes.id, disputeId));
    if (!d || d.status === 'resolved') throw new DomainError('DISPUTE_NOT_OPEN');
    await tx.update(t.disputes).set({ status: 'resolved', resolution: input.resolution.trim(), resolvedBy: staffId, resolvedAt: deps.now().toISOString() }).where(eq(t.disputes.id, disputeId));
    const [w] = await tx.select().from(t.works).where(eq(t.works.id, d.workId));
    const [signed] = await tx.select().from(t.splitVersions).where(and(eq(t.splitVersions.workId, d.workId), eq(t.splitVersions.status, 'signed')));
    const [last] = await tx.select().from(t.splitVersions).where(eq(t.splitVersions.workId, d.workId)).orderBy(desc(t.splitVersions.version)).limit(1);

    if (input.outcome === 'new_version') {
      if (last && last.status !== 'draft') {
        if (last.status === 'pending_signatures') await tx.update(t.splitVersions).set({ status: 'rejected' }).where(eq(t.splitVersions.id, last.id));
        const shares = await tx.select().from(t.splitShares).where(eq(t.splitShares.splitVersionId, last.id));
        const [v] = await tx.insert(t.splitVersions).values({ workId: d.workId, version: last.version + 1, createdBy: w!.createdBy, changeReason: `Disputa resuelta: ${input.resolution.trim()}` }).returning({ id: t.splitVersions.id });
        for (const s of shares) await tx.insert(t.splitShares).values({ splitVersionId: v!.id, writerUserId: s.writerUserId, externalName: s.externalName, externalEmail: s.externalEmail, externalIpi: s.externalIpi, externalSociety: s.externalSociety, role: s.role, shareBps: s.shareBps, administered: s.administered });
      }
      const to: WorkStatus = signed ? (w!.publisherWorkCode ? 'registered' : 'splits_signed') : 'draft';
      await setWorkStatus(tx, d.workId, to, staffId, 'disputa resuelta: nueva versión');
    } else {
      if (!last || last.status !== 'pending_signatures') throw new DomainError('NOTHING_TO_REINVITE');
      const now = deps.now();
      const shares = await tx.select().from(t.splitShares).where(and(eq(t.splitShares.splitVersionId, last.id), eq(t.splitShares.status, 'pending')));
      const invitedAt = now.toISOString();
      const expires = new Date(now.getTime() + 14 * 86_400_000).toISOString();
      const { guestSignToken } = await import('./crypto');
      for (const s of shares) {
        await tx.update(t.splitShares).set({ invitedAt, lastReminderAt: null, signTokenExpiresAt: expires, signTokenHash: s.writerUserId ? null : sha256(guestSignToken(deps.signingSecret, s.id, invitedAt)) }).where(eq(t.splitShares.id, s.id));
        await emit(tx, 'split.invitation', 'split_share', s.id, { workId: d.workId, versionId: last.id });
      }
      await setWorkStatus(tx, d.workId, signed ? (w!.publisherWorkCode ? 'registered' : 'splits_signed') : 'awaiting_signatures', staffId, 'disputa resuelta: reinvitación');
    }
  });
}

export async function listConflicts(deps: Deps, staffId: string) {
  await requireStaff(deps, staffId, ['operator', 'approver', 'super_admin']);
  return deps.db.execute<{ id: string; work_id: string; title: string; other_id: string; other_title: string; reason: string; score: string; status: string; created_at: string }>(sql`
    select c.id, c.work_id, w.title, c.conflicting_work_id as other_id, o.title as other_title, c.reason, c.score, c.status, c.created_at
    from work_conflicts c join works w on w.id = c.work_id join works o on o.id = c.conflicting_work_id
    order by (c.status = 'open') desc, c.created_at desc limit 200`);
}

export async function reviewConflict(deps: Deps, staffId: string, conflictId: string, status: 'dismissed' | 'escalated', ctx: RequestCtx) {
  const roles = await requireStaff(deps, staffId, ['operator', 'super_admin']);
  await withSystem(deps.db, staffCtx(staffId, roles[0]!, `conflict.${status}`, ctx), (tx) =>
    tx.update(t.workConflicts).set({ status, reviewedBy: staffId }).where(eq(t.workConflicts.id, conflictId)),
  );
}

/* ------------------------------ Configuración ----------------------------- */

export async function updatePlan(deps: Deps, staffId: string, code: PlanCode, input: { commissionBps: number; amountCents: number; stripePriceId: string; dailyApplications: number }, ctx: RequestCtx) {
  await requireStaff(deps, staffId, ['super_admin']);
  if (!Number.isInteger(input.commissionBps) || input.commissionBps < 0 || input.commissionBps > 5000) throw new DomainError('COMMISSION_INVALID');
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) throw new DomainError('PRICE_INVALID');
  await withSystem(deps.db, staffCtx(staffId, 'super_admin', 'plan.update', ctx), async (tx) => {
    const [plan] = await tx.select().from(t.plans).where(eq(t.plans.code, code));
    const features = { ...(plan!.features as Record<string, unknown>), dailyApplications: input.dailyApplications };
    await tx.update(t.plans).set({ commissionBps: input.commissionBps, features }).where(eq(t.plans.code, code));
    const [price] = await tx.select().from(t.planPrices).where(and(eq(t.planPrices.planCode, code), eq(t.planPrices.region, 'GLOBAL'), isNull(t.planPrices.validTo)));
    if (price && (price.amountCents !== input.amountCents || price.stripePriceId !== input.stripePriceId)) {
      const today = deps.now().toISOString().slice(0, 10);
      if (price.validFrom === today) {
        await tx.update(t.planPrices).set({ amountCents: input.amountCents, stripePriceId: input.stripePriceId }).where(eq(t.planPrices.id, price.id));
      } else {
        await tx.update(t.planPrices).set({ validTo: today }).where(eq(t.planPrices.id, price.id));
        await tx.insert(t.planPrices).values({ planCode: code, region: 'GLOBAL', amountCents: input.amountCents, currency: 'USD', stripePriceId: input.stripePriceId, validFrom: today });
      }
    }
  });
}

export async function grantRole(deps: Deps, staffId: string, email: string, role: 'operator' | 'approver' | 'super_admin' | 'ar_guest' | 'sync_buyer', ctx: RequestCtx) {
  await requireStaff(deps, staffId, ['super_admin']);
  const [u] = await deps.db.select().from(t.users).where(eq(t.users.email, email.trim().toLowerCase()));
  if (!u) throw new DomainError('USER_NOT_FOUND');
  await withSystem(deps.db, staffCtx(staffId, 'super_admin', 'role.grant', ctx), async (tx) => {
    await tx.insert(t.userRoles).values({ userId: u.id, role, grantedBy: staffId }).onConflictDoNothing();
    if (role !== 'ar_guest' && role !== 'sync_buyer') await tx.update(t.users).set({ mfaRequired: true }).where(eq(t.users.id, u.id));
  });
}

export async function revokeRole(deps: Deps, staffId: string, userId: string, role: StaffRole, ctx: RequestCtx) {
  await requireStaff(deps, staffId, ['super_admin']);
  if (userId === staffId && role === 'super_admin') throw new DomainError('CANNOT_REVOKE_SELF');
  await withSystem(deps.db, staffCtx(staffId, 'super_admin', 'role.revoke', ctx), (tx) =>
    tx.delete(t.userRoles).where(and(eq(t.userRoles.userId, userId), eq(t.userRoles.role, role))),
  );
}

export async function listStaff(deps: Deps, staffId: string) {
  await requireStaff(deps, staffId, ['super_admin']);
  return deps.db
    .select({ userId: t.userRoles.userId, role: t.userRoles.role, email: t.users.email, grantedAt: t.userRoles.grantedAt })
    .from(t.userRoles)
    .innerJoin(t.users, eq(t.users.id, t.userRoles.userId))
    .where(inArray(t.userRoles.role, ['operator', 'approver', 'super_admin']));
}

/* -------------------------------- Auditoría ------------------------------- */

export async function auditLog(deps: Deps, staffId: string, filter: { entityId?: string; actorId?: string; command?: string; limit?: number } = {}) {
  await requireStaff(deps, staffId, ['operator', 'approver', 'super_admin']);
  const conds = [];
  if (filter.entityId) conds.push(eq(t.auditLog.entityId, filter.entityId));
  if (filter.actorId) conds.push(eq(t.auditLog.actorUserId, filter.actorId));
  if (filter.command) conds.push(ilike(t.auditLog.command, `${filter.command}%`));
  const rows = await deps.db.select().from(t.auditLog).where(conds.length ? and(...conds) : undefined).orderBy(desc(t.auditLog.id)).limit(Math.min(filter.limit ?? 200, 1000));
  const [{ broken }] = (await deps.db.execute<{ broken: string | null }>(sql`select audit_verify_chain() as broken`)) as unknown as [{ broken: string | null }];
  return { rows, chainBrokenAt: broken };
}
