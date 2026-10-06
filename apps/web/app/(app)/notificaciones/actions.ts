'use server';

import { revalidatePath } from 'next/cache';
import { notifications } from '@pluma/services';
import { deps, requireMember } from '@/lib/server';

export async function markAllReadAction() {
  const s = await requireMember();
  await notifications.markRead(deps(), s.userId, 'all');
  revalidatePath('/', 'layout');
}
