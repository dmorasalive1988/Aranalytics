'use server';

import { revalidatePath } from 'next/cache';
import { profiles } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, requestCtx, requireStaff } from '@/lib/server';

export async function hideAction(requestId: string, hidden: boolean, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await profiles.setRequestHidden(deps(), s.id, requestId, hidden, str(fd, 'reason'), await requestCtx());
    revalidatePath('/red');
    return { ok: hidden ? 'Solicitud oculta.' : 'Solicitud visible de nuevo.' };
  });
}

export async function reviewCreditAction(creditId: string, approve: boolean, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await profiles.reviewCredit(deps(), s.id, creditId, approve, str(fd, 'reason'), await requestCtx());
    revalidatePath('/red');
    return { ok: approve ? 'Crédito verificado.' : 'Crédito rechazado.' };
  });
}
