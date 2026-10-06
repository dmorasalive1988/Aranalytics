import { t, type Tx } from '@pluma/db';

export type EventType =
  | 'split.invitation'
  | 'split.reminder'
  | 'split.signed'
  | 'split.completed'
  | 'split.rejected'
  | 'work.created'
  | 'work.authorship_changed'
  | 'work.status_changed'
  | 'work.conflict_detected'
  | 'membership.activated'
  | 'membership.renewal_upcoming'
  | 'membership.payment_failed'
  | 'membership.suspended'
  | 'statement.published'
  | 'payout.requested'
  | 'payout.sent';

/** Outbox transaccional: el evento se guarda en la misma transacción que el cambio. */
export async function emit(tx: Tx, type: EventType, aggregateType: string, aggregateId: string, payload: Record<string, unknown> = {}) {
  await tx.insert(t.domainEvents).values({ type, aggregateType, aggregateId, payload });
}
