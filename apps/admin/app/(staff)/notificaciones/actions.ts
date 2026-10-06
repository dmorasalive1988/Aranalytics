'use server';

import { revalidatePath } from 'next/cache';
import { notifications } from '@pluma/services';
import { run, type ActionState } from '@/lib/actions';
import { deps, requestCtx, requireStaff } from '@/lib/server';

export async function resendAction(notificationId: string, channel: 'email' | 'push' | 'whatsapp'): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    const ok = await notifications.resendDelivery(deps(), s.id, notificationId, channel, await requestCtx());
    revalidatePath('/notificaciones');
    return ok ? { ok: 'Reenviado.' } : { error: 'Volvió a fallar. Revisa el detalle del error.' };
  });
}

export async function unsuppressAction(email: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await notifications.removeSuppression(deps(), s.id, email, await requestCtx());
    revalidatePath('/notificaciones');
    return { ok: `${email} vuelve a recibir correos.` };
  });
}
