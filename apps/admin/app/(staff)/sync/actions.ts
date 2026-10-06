'use server';

import { revalidatePath } from 'next/cache';
import { inlineDispatch } from '@pluma/db/env';
import { after } from 'next/server';
import { catalog, dispatchPending } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, requestCtx, requireStaff } from '@/lib/server';

const dispatch = () => {
  if (inlineDispatch()) after(() => dispatchPending(deps()).catch(() => {}));
};

export async function licenseStatusAction(id: string, next: 'negotiating' | 'issued' | 'canceled', _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    const fee = str(fd, 'fee');
    await catalog.setLicenseStatus(deps(), s.id, id, next, { finalFeeCents: fee ? Math.round(Number(fee.replace(',', '.')) * 100) : null, note: str(fd, 'note') || null }, await requestCtx());
    dispatch();
    revalidatePath('/sync');
    return { ok: 'Listo.' };
  });
}

export async function operatorBriefAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await catalog.createBrief(deps(), s.id, { title: str(fd, 'title'), description: str(fd, 'description'), moods: [], genres: str(fd, 'genres').split(','), languages: ['es'], usage: str(fd, 'usage'), territory: str(fd, 'territory'), termMonths: 12, budgetMinCents: null, budgetMaxCents: null, deadline: str(fd, 'deadline') || null }, await requestCtx());
    revalidatePath('/sync');
    return { ok: 'Brief publicado.' };
  });
}

export async function inviteArAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await catalog.inviteAr(deps(), s.id, { email: str(fd, 'email'), company: str(fd, 'company') }, await requestCtx());
    dispatch();
    revalidatePath('/ar');
    return { ok: 'Invitación enviada.' };
  });
}

export async function revokeArAction(id: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await catalog.revokeArInvitation(deps(), s.id, id, await requestCtx());
    revalidatePath('/ar');
    return { ok: 'Invitación revocada.' };
  });
}
