'use server';

import { revalidatePath } from 'next/cache';
import { isLocale } from '@pluma/i18n';
import { setLocale } from '@pluma/services';
import { deps, getAuth, setLocaleCookie } from '@/lib/server';

export async function changeLocale(locale: string) {
  if (!isLocale(locale)) return;
  await setLocaleCookie(locale);
  const user = await (await getAuth()).getUser().catch(() => null);
  if (user) await setLocale(deps(), user.id, locale).catch(() => {});
  revalidatePath('/', 'layout');
}
