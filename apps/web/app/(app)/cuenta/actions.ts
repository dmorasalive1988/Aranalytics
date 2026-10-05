'use server';

import { revalidatePath } from 'next/cache';
import { getLocale, getTranslations } from 'next-intl/server';
import { scheduleDowngrade, upgradeToPro } from '@pluma/services';
import { run, type ActionState } from '@/lib/actions';
import { money } from '@/lib/format';
import { deps, kickDispatch, requestCtx, requireMember } from '@/lib/server';

export async function upgradeAction(_: ActionState): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    const { chargedCents } = await upgradeToPro(deps(), s.userId, await requestCtx());
    await kickDispatch();
    revalidatePath('/', 'layout');
    const t = await getTranslations('account');
    return { ok: `${t('upgraded')} (${money(chargedCents, await getLocale(), s.profile?.country)})` };
  });
}

export async function downgradeAction(_: ActionState): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await scheduleDowngrade(deps(), s.userId, await requestCtx());
    revalidatePath('/cuenta/plan');
  });
}
