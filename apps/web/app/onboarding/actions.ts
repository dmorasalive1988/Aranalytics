'use server';

import { redirect } from 'next/navigation';
import { choosePlan, requestGuardianCode, saveGuardian, saveProfile, saveSociety, signAdminAgreement, signAdminAgreementAsGuardian, startCheckout } from '@pluma/services';
import { getTranslations } from 'next-intl/server';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, requestCtx, requireUser } from '@/lib/server';

const appUrl = () => process.env.PLUMA_APP_URL ?? 'http://localhost:3000';

export async function profileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireUser();
    await saveProfile(deps(), s.userId, { legalName: str(fd, 'legalName'), artistName: str(fd, 'artistName'), country: str(fd, 'country'), city: str(fd, 'city'), birthDate: str(fd, 'birthDate') }, await requestCtx());
    redirect('/onboarding/sociedad');
  });
}

export async function societyAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireUser();
    const choice = str(fd, 'society');
    await saveSociety(
      deps(),
      s.userId,
      { societyCode: choice === 'OTHER' || choice === 'NONE' ? null : choice, societyOther: choice === 'NONE' ? 'NONE' : choice === 'OTHER' ? str(fd, 'otherName') : null, ipi: str(fd, 'ipi') || null },
      await requestCtx(),
    );
    redirect('/');
  });
}

export async function guardianAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireUser();
    await saveGuardian(deps(), s.userId, { legalName: str(fd, 'name'), email: str(fd, 'email'), relationship: str(fd, 'relationship') }, await requestCtx());
    redirect('/onboarding/plan');
  });
}

export async function planAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireUser();
    const plan = str(fd, 'plan') === 'pro' ? 'pro' : 'socio';
    await choosePlan(deps(), s.userId, plan, await requestCtx());
    redirect('/onboarding/contrato');
  });
}

export async function signContractAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    if (fd.get('accept') !== 'on') return { error: (await getTranslations('onboarding.contract'))('accept') };
    const s = await requireUser();
    await signAdminAgreement(deps(), s.userId, await requestCtx());
    redirect('/onboarding/pago');
  });
}

export async function guardianCodeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    if (fd.get('accept') !== 'on') return { error: (await getTranslations('onboarding.contract'))('accept') };
    const s = await requireUser();
    await requestGuardianCode(deps(), s.userId);
    return { ok: (await getTranslations('onboarding.contract'))('codeSent') };
  });
}

export async function guardianSignAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireUser();
    await signAdminAgreementAsGuardian(deps(), s.userId, str(fd, 'code'), await requestCtx());
    redirect('/onboarding/pago');
  });
}

export async function checkoutAction(_: ActionState): Promise<ActionState> {
  return run(async () => {
    const s = await requireUser();
    const { url } = await startCheckout(deps(), s.userId, { successUrl: `${appUrl()}/onboarding/listo`, cancelUrl: `${appUrl()}/onboarding/pago` });
    redirect(url);
  });
}
