import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthError } from '@pluma/adapters';
import { isDomainError } from '@pluma/domain';

export interface ActionState {
  error?: string;
  ok?: string;
}

/**
 * Ejecuta una acción de servidor y traduce los errores de negocio al idioma de la persona.
 * Los redirect() se propagan.
 */
export async function run(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? {};
  } catch (e) {
    unstable_rethrow(e);
    const t = await getTranslations();
    if (e instanceof AuthError) return { error: t(`auth.errors.${e.code}`) };
    if (isDomainError(e)) return { error: t.has(`errors.${e.code}`) ? t(`errors.${e.code}`) : t('errors.generic') };
    console.error(e);
    return { error: t('errors.generic') };
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
