'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { rejectAsGuest, sendGuestCode, signAsGuest } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { currentLocale, deps, kickDispatch, requestCtx } from '@/lib/server';

export async function guestCodeAction(token: string, _: ActionState): Promise<ActionState> {
  return run(async () => {
    const { sentTo } = await sendGuestCode(deps(), token, await currentLocale());
    return { ok: (await getTranslations('guest'))('codeSent', { email: sentTo }) };
  });
}

export async function guestSignAction(token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await signAsGuest(deps(), token, str(fd, 'code'), await requestCtx());
    await kickDispatch();
    revalidatePath(`/firmar/t/${token}`);
  });
}

export async function guestRejectAction(token: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    await rejectAsGuest(deps(), token, str(fd, 'code'), str(fd, 'reason'), await requestCtx());
    await kickDispatch();
    revalidatePath(`/firmar/t/${token}`);
  });
}
