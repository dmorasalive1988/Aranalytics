'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { catalog } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, kickDispatch, requestCtx, requirePortalRole, requireUser } from '@/lib/server';

export async function acceptInvitationAction(token: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireUser(`/ar/invitacion/${token}`);
    await catalog.acceptArInvitation(deps(), s.userId, token, await requestCtx());
    redirect('/ar/catalogo');
  });
}

export async function interestAction(workId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requirePortalRole('ar_guest', `/ar/obra/${workId}`);
    await catalog.expressInterest(deps(), s.userId, workId, str(fd, 'message'), await requestCtx());
    await kickDispatch();
    revalidatePath(`/ar/obra/${workId}`);
    return { ok: (await getTranslations('ar'))('interestSent') };
  });
}

export async function holdAction(workId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requirePortalRole('ar_guest', `/ar/obra/${workId}`);
    await catalog.requestHold(deps(), s.userId, workId, Number(str(fd, 'days')), str(fd, 'message'), await requestCtx());
    await kickDispatch();
    revalidatePath(`/ar/obra/${workId}`);
    return { ok: (await getTranslations('ar'))('holdRequested') };
  });
}
