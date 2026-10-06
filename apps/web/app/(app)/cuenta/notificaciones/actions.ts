'use server';

import { revalidatePath } from 'next/cache';
import { notifications } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, requestCtx, requireMember } from '@/lib/server';

type Category = 'money' | 'splits' | 'membership' | 'works';
type Channel = 'email' | 'push' | 'whatsapp';

export async function setPreferenceAction(category: Category, channel: Channel, enabled: boolean): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await notifications.setPreference(deps(), s.userId, category, channel, enabled);
    revalidatePath('/cuenta/notificaciones');
  });
}

export async function subscribePushAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await notifications.subscribePush(deps(), s.userId, sub);
    revalidatePath('/cuenta/notificaciones');
  });
}

export async function unsubscribePushAction(endpoint: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await notifications.unsubscribePush(deps(), s.userId, endpoint);
    revalidatePath('/cuenta/notificaciones');
  });
}

export async function whatsappOnAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await notifications.setWhatsApp(deps(), s.userId, { phone: str(fd, 'phone'), consent: fd.get('consent') === 'on' }, await requestCtx());
    revalidatePath('/cuenta/notificaciones');
  });
}

export async function whatsappOffAction(_: ActionState): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await notifications.setWhatsApp(deps(), s.userId, { phone: null, consent: false }, await requestCtx());
    revalidatePath('/cuenta/notificaciones');
  });
}
