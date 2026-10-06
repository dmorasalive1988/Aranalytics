'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { parseMoneyInput } from '@pluma/domain';
import { payouts } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, kickDispatch, requestCtx, requireMember } from '@/lib/server';

export async function kycAction(_: ActionState): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await payouts.requestKyc(deps(), s.userId, await requestCtx());
    revalidatePath('/pagos/retirar');
  });
}

export async function taxAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await payouts.saveTaxProfile(deps(), s.userId, { taxCountry: str(fd, 'taxCountry'), taxId: str(fd, 'taxId'), entityType: str(fd, 'entity') === 'company' ? 'company' : 'individual' }, await requestCtx());
    revalidatePath('/pagos/retirar');
  });
}

export async function methodAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await payouts.savePayoutMethod(deps(), s.userId, { provider: str(fd, 'provider') === 'payoneer' ? 'payoneer' : 'wise', holderName: str(fd, 'holder'), account: str(fd, 'account'), bankName: str(fd, 'bank') || null, currency: str(fd, 'currency') }, await requestCtx());
    revalidatePath('/pagos/retirar');
  });
}

export async function payoutAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    const amount = parseMoneyInput(str(fd, 'amount'));
    await payouts.requestPayout(deps(), s.userId, amount === null ? 0 : Math.round(Number(amount) * 100), await requestCtx());
    await kickDispatch();
    revalidatePath('/pagos', 'layout');
    return { ok: (await getTranslations('withdraw'))('requested') };
  });
}
