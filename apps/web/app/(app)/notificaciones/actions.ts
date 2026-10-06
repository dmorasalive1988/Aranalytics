'use server';

import { notifications } from '@pluma/services';
import { deps, requireMember } from '@/lib/server';

/** Al abrir el centro: todo queda leído, sin recargar la pantalla (la campana se apaga en el cliente). */
export async function markSeenAction() {
  const s = await requireMember();
  await notifications.markRead(deps(), s.userId, 'all');
}
