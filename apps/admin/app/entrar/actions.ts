'use server';

import { redirect } from 'next/navigation';
import { admin } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, getAuth } from '@/lib/server';

export async function signInAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const auth = await getAuth();
    const user = await auth.signIn(str(fd, 'email'), str(fd, 'password'));
    if (!(await admin.staffRoles(deps(), user.id)).length) {
      await auth.signOut();
      return { error: 'Esta cuenta no tiene acceso al back-office.' };
    }
    redirect('/');
  });
}

export async function signOutAction() {
  await (await getAuth()).signOut();
  redirect('/entrar');
}
