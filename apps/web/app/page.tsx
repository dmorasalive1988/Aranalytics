import { redirect } from 'next/navigation';
import { getSession } from '@pluma/services';
import { deps, getAuth, STEP_PATH } from '@/lib/server';

/** Punto de entrada: bienvenida, verificación, el paso de onboarding que toca o el inicio. */
export default async function Root() {
  const user = await (await getAuth()).getUser();
  if (!user) redirect('/bienvenida');
  if (!user.emailVerified) redirect(`/verificar?email=${encodeURIComponent(user.email)}`);
  const s = await getSession(deps(), user.id);
  redirect(s ? STEP_PATH[s.step] : STEP_PATH.profile);
}
