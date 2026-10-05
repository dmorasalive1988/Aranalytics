import { and, eq, isNotNull, t, withSystem, sql } from '@pluma/db';
import type { Deps } from './deps';
import { emit } from './events';
import { runMembershipJobs } from './membership';

const DAY = 86_400_000;
export const REMINDER_EVERY_DAYS = 3;

/**
 * Tarea diaria de firmas: recordatorio cada 3 días y, si la invitación vence sin firma,
 * la obra pasa a "En disputa" para que un operador la revise.
 */
export async function runSplitJobs(deps: Deps) {
  const now = deps.now();
  const pending = await deps.db
    .select({ share: t.splitShares, workId: t.splitVersions.workId })
    .from(t.splitShares)
    .innerJoin(t.splitVersions, eq(t.splitVersions.id, t.splitShares.splitVersionId))
    .where(and(eq(t.splitVersions.status, 'pending_signatures'), eq(t.splitShares.status, 'pending'), isNotNull(t.splitShares.invitedAt)));

  let reminded = 0;
  let expired = 0;
  for (const { share, workId } of pending) {
    const invitedAt = new Date(share.invitedAt!).getTime();
    const expiresAt = share.signTokenExpiresAt ? new Date(share.signTokenExpiresAt).getTime() : invitedAt + 14 * DAY;
    if (expiresAt < now.getTime()) {
      await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'split.invitation_expired' }, async (tx) => {
        const open = await tx.select({ id: t.disputes.id }).from(t.disputes).where(and(eq(t.disputes.splitVersionId, share.splitVersionId), eq(t.disputes.status, 'open')));
        if (open.length) return;
        await tx.insert(t.disputes).values({ workId, splitVersionId: share.splitVersionId, reason: 'UNSIGNED_EXPIRED', raisedByEmail: share.externalEmail });
        const [w] = await tx.select().from(t.works).where(eq(t.works.id, workId));
        if (w && w.status !== 'disputed') {
          await tx.update(t.works).set({ status: 'disputed' }).where(eq(t.works.id, workId));
          await tx.insert(t.workStatusHistory).values({ workId, fromStatus: w.status, toStatus: 'disputed', note: 'invitación vencida sin firma' });
          await emit(tx, 'work.status_changed', 'work', workId, { from: w.status, to: 'disputed' });
        }
      });
      expired++;
      continue;
    }
    const last = share.lastReminderAt ? new Date(share.lastReminderAt).getTime() : invitedAt;
    if (now.getTime() - last >= REMINDER_EVERY_DAYS * DAY) {
      await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'split.reminder' }, async (tx) => {
        await tx.update(t.splitShares).set({ lastReminderAt: now.toISOString() }).where(eq(t.splitShares.id, share.id));
        await emit(tx, 'split.reminder', 'split_share', share.id, { n: now.toISOString().slice(0, 10) });
      });
      reminded++;
    }
  }
  return { reminded, expired };
}

export async function runDailyJobs(deps: Deps) {
  const splits = await runSplitJobs(deps);
  const memberships = await runMembershipJobs(deps);
  const [{ broken }] = (await deps.db.execute<{ broken: string | null }>(sql`select audit_verify_chain() as broken`)) as unknown as [{ broken: string | null }];
  if (broken) console.error(`[auditoría] cadena rota en la fila ${broken}`);
  return { splits, memberships, auditChainBrokenAt: broken };
}
