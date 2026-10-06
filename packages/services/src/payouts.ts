import { and, desc, eq, inArray, t, withSystem, sql } from '@pluma/db';
import { DomainError } from '@pluma/domain';
import { decryptJson, encryptJson } from './crypto';
import type { Deps, RequestCtx } from './deps';
import { emit } from './events';
import * as admin from './admin';

const writerCtx = (userId: string, command: string, ctx: RequestCtx) => ({ actorId: userId, actorRole: 'writer' as const, command, ...ctx });

export interface PayoutMethodInput {
  provider: 'wise' | 'payoneer';
  holderName: string;
  /** Correo de Payoneer/Wise, IBAN o número de cuenta. */
  account: string;
  bankName: string | null;
  currency: string;
}

/** A11 · Método de cobro (cifrado en la base; solo se muestran los últimos 4 caracteres). */
export async function savePayoutMethod(deps: Deps, userId: string, input: PayoutMethodInput, ctx: RequestCtx) {
  if (!['wise', 'payoneer'].includes(input.provider)) throw new DomainError('PAYOUT_PROVIDER_INVALID');
  if (input.holderName.trim().length < 3 || input.account.trim().length < 4) throw new DomainError('PAYOUT_DETAILS_INVALID');
  if (!/^[A-Z]{3}$/.test(input.currency)) throw new DomainError('CURRENCY_INVALID');
  const tail = input.account.trim().slice(-4);
  const label = `${input.provider === 'wise' ? 'Wise' : 'Payoneer'}${input.bankName ? ` · ${input.bankName}` : ''} ••${tail}`;
  await withSystem(deps.db, writerCtx(userId, 'payout_method.save', ctx), async (tx) => {
    await tx.update(t.payoutMethods).set({ isDefault: false }).where(eq(t.payoutMethods.userId, userId));
    await tx.insert(t.payoutMethods).values({ userId, provider: input.provider, currency: input.currency, detailsEnc: encryptJson(deps.dataKey, input), label, isDefault: true });
  });
}

/** A11 · Datos fiscales (ID cifrado). */
export async function saveTaxProfile(deps: Deps, userId: string, input: { taxCountry: string; taxId: string; entityType: 'individual' | 'company' }, ctx: RequestCtx) {
  if (!/^[A-Z]{2}$/.test(input.taxCountry)) throw new DomainError('COUNTRY_REQUIRED');
  const id = input.taxId.replace(/\s/g, '');
  if (id.length < 5) throw new DomainError('TAX_ID_INVALID');
  const values = { userId, taxCountry: input.taxCountry, taxIdEnc: encryptJson(deps.dataKey, { taxId: id }), taxIdLast4: id.slice(-4), entityType: input.entityType };
  await withSystem(deps.db, writerCtx(userId, 'tax_profile.save', ctx), (tx) => tx.insert(t.taxProfiles).values(values).onConflictDoUpdate({ target: t.taxProfiles.userId, set: values }));
}

/** A12 · Verificación de identidad: en el MVP la revisa un operador (E11). */
export async function requestKyc(deps: Deps, userId: string, ctx: RequestCtx) {
  await withSystem(deps.db, writerCtx(userId, 'kyc.request', ctx), async (tx) => {
    const [u] = await tx.select().from(t.users).where(eq(t.users.id, userId));
    if (u?.kycStatus === 'approved' || u?.kycStatus === 'pending') return;
    await tx.update(t.users).set({ kycStatus: 'pending' }).where(eq(t.users.id, userId));
    await tx.insert(t.kycChecks).values({ userId, provider: 'manual', providerRef: `manual-${userId}`, status: 'pending' });
  });
}

export async function balanceCents(deps: Deps, userId: string) {
  const [{ bal }] = (await deps.db.execute<{ bal: string }>(sql`select coalesce(sum(amount_cents), 0)::text as bal from writer_ledger_entries where writer_user_id = ${userId} and currency = 'USD'`)) as unknown as [{ bal: string }];
  return Number(bal);
}

export async function payoutReadiness(deps: Deps, userId: string) {
  const [u] = await deps.db.select({ kyc: t.users.kycStatus }).from(t.users).where(eq(t.users.id, userId));
  const [method] = await deps.db.select({ id: t.payoutMethods.id, label: t.payoutMethods.label }).from(t.payoutMethods).where(and(eq(t.payoutMethods.userId, userId), eq(t.payoutMethods.isDefault, true)));
  const [tax] = await deps.db.select({ country: t.taxProfiles.taxCountry, last4: t.taxProfiles.taxIdLast4 }).from(t.taxProfiles).where(eq(t.taxProfiles.userId, userId));
  const [min] = await deps.db.select({ v: t.settings.value }).from(t.settings).where(eq(t.settings.key, 'payouts.minimum_cents'));
  return { kyc: u?.kyc ?? 'not_started', method: method ?? null, tax: tax ?? null, minimumCents: Number(min?.v ?? 2000), balanceCents: await balanceCents(deps, userId) };
}

/**
 * A17 · Solicitud de retiro. Exige KYC aprobado, datos fiscales y método de cobro. El monto se
 * reserva en el ledger al pedirlo (no se puede pedir dos veces el mismo saldo).
 */
export async function requestPayout(deps: Deps, userId: string, amountCents: number, ctx: RequestCtx) {
  const r = await payoutReadiness(deps, userId);
  if (r.kyc !== 'approved') throw new DomainError('KYC_REQUIRED');
  if (!r.tax) throw new DomainError('TAX_PROFILE_REQUIRED');
  if (!r.method) throw new DomainError('PAYOUT_METHOD_REQUIRED');
  if (!Number.isInteger(amountCents) || amountCents < r.minimumCents) throw new DomainError('PAYOUT_BELOW_MINIMUM', { minimumCents: r.minimumCents });
  return withSystem(deps.db, writerCtx(userId, 'payout.request', ctx), async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`payout:${userId}`}))`);
    const [{ bal }] = (await tx.execute<{ bal: string }>(sql`select coalesce(sum(amount_cents), 0)::text as bal from writer_ledger_entries where writer_user_id = ${userId} and currency = 'USD'`)) as unknown as [{ bal: string }];
    if (amountCents > Number(bal)) throw new DomainError('PAYOUT_ABOVE_BALANCE');
    const [p] = await tx.insert(t.payouts).values({ writerUserId: userId, payoutMethodId: r.method!.id, amountCents, currency: 'USD' }).returning({ id: t.payouts.id });
    await tx.insert(t.writerLedgerEntries).values({ writerUserId: userId, type: 'payout_debit', amountCents: -amountCents, currency: 'USD', payoutId: p!.id, memo: 'retiro solicitado' });
    await emit(tx, 'payout.requested', 'payout', p!.id);
    return p!.id;
  });
}

export async function myPayouts(deps: Deps, userId: string) {
  return deps.db
    .select({ id: t.payouts.id, amountCents: t.payouts.amountCents, currency: t.payouts.currency, status: t.payouts.status, requestedAt: t.payouts.requestedAt, paidAt: t.payouts.paidAt, label: t.payoutMethods.label })
    .from(t.payouts)
    .innerJoin(t.payoutMethods, eq(t.payoutMethods.id, t.payouts.payoutMethodId))
    .where(eq(t.payouts.writerUserId, userId))
    .orderBy(desc(t.payouts.requestedAt));
}

/* ------------------------- Back-office (E15) ------------------------- */

async function staffRole(deps: Deps, userId: string, allowed: admin.StaffRole[]) {
  const role = (await admin.staffRoles(deps, userId)).find((r) => allowed.includes(r));
  if (!role) throw new DomainError('FORBIDDEN');
  return role;
}

export async function listPayoutsAdmin(deps: Deps, staffId: string) {
  await staffRole(deps, staffId, ['operator', 'approver', 'super_admin']);
  return deps.db
    .select({ id: t.payouts.id, writerUserId: t.payouts.writerUserId, name: t.writerProfiles.legalName, amountCents: t.payouts.amountCents, currency: t.payouts.currency, status: t.payouts.status, batchId: t.payouts.batchId, preparedBy: t.payouts.preparedBy, approvedBy: t.payouts.approvedBy, providerRef: t.payouts.providerRef, requestedAt: t.payouts.requestedAt, method: t.payoutMethods.label, kyc: t.users.kycStatus })
    .from(t.payouts)
    .innerJoin(t.payoutMethods, eq(t.payoutMethods.id, t.payouts.payoutMethodId))
    .innerJoin(t.writerProfiles, eq(t.writerProfiles.userId, t.payouts.writerUserId))
    .innerJoin(t.users, eq(t.users.id, t.payouts.writerUserId))
    .orderBy(desc(t.payouts.requestedAt))
    .limit(300);
}

/** El operador arma el lote. */
export async function preparePayoutBatch(deps: Deps, staffId: string, ids: string[], ctx: RequestCtx) {
  const role = await staffRole(deps, staffId, ['operator', 'super_admin']);
  if (!ids.length) throw new DomainError('NOTHING_SELECTED');
  const batchId = crypto.randomUUID();
  await withSystem(deps.db, { actorId: staffId, actorRole: role, command: 'payout.prepare', ...ctx }, (tx) =>
    tx.update(t.payouts).set({ batchId, preparedBy: staffId }).where(and(inArray(t.payouts.id, ids), eq(t.payouts.status, 'requested'))),
  );
  return batchId;
}

/** Un aprobador distinto autoriza el lote (doble aprobación; la base también lo exige). */
export async function approvePayoutBatch(deps: Deps, staffId: string, batchId: string, ctx: RequestCtx) {
  const role = await staffRole(deps, staffId, ['approver', 'super_admin']);
  await withSystem(deps.db, { actorId: staffId, actorRole: role, command: 'payout.approve', ...ctx }, async (tx) => {
    const rows = await tx.select().from(t.payouts).where(and(eq(t.payouts.batchId, batchId), eq(t.payouts.status, 'requested')));
    if (!rows.length) throw new DomainError('NOTHING_SELECTED');
    if (rows.some((r) => r.preparedBy === staffId)) throw new DomainError('APPROVER_MUST_DIFFER');
    await tx.update(t.payouts).set({ status: 'approved', approvedBy: staffId }).where(and(eq(t.payouts.batchId, batchId), eq(t.payouts.status, 'requested')));
  });
}

/** CSV del lote para carga masiva en el proveedor de pagos (envío semiautomático). */
export async function payoutBatchCsv(deps: Deps, staffId: string, batchId: string) {
  await staffRole(deps, staffId, ['operator', 'approver', 'super_admin']);
  const rows = await deps.db.select({ p: t.payouts, m: t.payoutMethods }).from(t.payouts).innerJoin(t.payoutMethods, eq(t.payoutMethods.id, t.payouts.payoutMethodId)).where(and(eq(t.payouts.batchId, batchId), eq(t.payouts.status, 'approved')));
  const lines = ['payout_id,provider,holder,account,bank,currency,amount'];
  for (const { p, m } of rows) {
    const d = decryptJson<PayoutMethodInput>(deps.dataKey, m.detailsEnc as Buffer);
    lines.push([p.id, m.provider, d.holderName, d.account, d.bankName ?? '', p.currency, (Number(p.amountCents) / 100).toFixed(2)].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','));
  }
  return lines.join('\n') + '\n';
}

export async function markPayoutSent(deps: Deps, staffId: string, payoutId: string, providerRef: string, ctx: RequestCtx) {
  const role = await staffRole(deps, staffId, ['operator', 'super_admin']);
  if (!providerRef.trim()) throw new DomainError('PROVIDER_REF_REQUIRED');
  await withSystem(deps.db, { actorId: staffId, actorRole: role, command: 'payout.mark_sent', ...ctx }, async (tx) => {
    const [p] = await tx.select().from(t.payouts).where(eq(t.payouts.id, payoutId));
    if (p?.status !== 'approved') throw new DomainError('PAYOUT_NOT_APPROVED');
    await tx.update(t.payouts).set({ status: 'paid', providerRef: providerRef.trim(), paidAt: deps.now().toISOString() }).where(eq(t.payouts.id, payoutId));
    await emit(tx, 'payout.sent', 'payout', payoutId);
  });
}

/** Pago fallido o cancelado: se devuelve el monto al saldo (asiento de reverso, nunca se borra el débito). */
export async function failPayout(deps: Deps, staffId: string, payoutId: string, reason: string, ctx: RequestCtx) {
  const role = await staffRole(deps, staffId, ['operator', 'super_admin']);
  await withSystem(deps.db, { actorId: staffId, actorRole: role, command: 'payout.fail', ...ctx }, async (tx) => {
    const [p] = await tx.select().from(t.payouts).where(eq(t.payouts.id, payoutId));
    if (!p || !['requested', 'approved'].includes(p.status)) throw new DomainError('PAYOUT_NOT_OPEN');
    await tx.update(t.payouts).set({ status: 'failed', failureReason: reason.trim() || 'sin motivo' }).where(eq(t.payouts.id, payoutId));
    await tx.insert(t.writerLedgerEntries).values({ writerUserId: p.writerUserId, type: 'payout_reversal', amountCents: Number(p.amountCents), currency: 'USD', payoutId, memo: `reverso: ${reason.trim()}` });
  });
}
