import 'server-only';
import { and, eq, t } from '@pluma/db';
import { deps } from './server';

/** Participaciones del usuario esperando su firma. */
export async function pendingForMe(userId: string) {
  return deps()
    .db.select({ shareId: t.splitShares.id, workId: t.splitVersions.workId })
    .from(t.splitShares)
    .innerJoin(t.splitVersions, eq(t.splitVersions.id, t.splitShares.splitVersionId))
    .where(and(eq(t.splitShares.writerUserId, userId), eq(t.splitShares.status, 'pending'), eq(t.splitVersions.status, 'pending_signatures')));
}
