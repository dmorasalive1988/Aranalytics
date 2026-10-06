'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { network, profiles } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, kickDispatch, requestCtx, requireMember } from '@/lib/server';

const audioOf = async (fd: FormData, name: string) => {
  const f = fd.get(name);
  return f instanceof File && f.size > 0 ? { bytes: Buffer.from(await f.arrayBuffer()), mime: f.type } : null;
};
const pctToBps = (v: string) => Math.round(Number(v.replace(',', '.')) * 100);

export async function publishAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    const bpm = str(fd, 'bpm');
    const id = await network.createRequest(
      deps(),
      s.userId,
      { type: str(fd, 'type'), title: str(fd, 'title'), description: str(fd, 'description'), genre: str(fd, 'genre'), languages: fd.getAll('languages').map(String), bpm: bpm ? Number(bpm) : null, city: str(fd, 'city') || null, modality: str(fd, 'modality'), offeredShareBps: pctToBps(str(fd, 'offered')) },
      await audioOf(fd, 'demo'),
      await requestCtx(),
    );
    revalidatePath('/red', 'layout');
    redirect(`/red/${id}`);
  });
}

export async function applyAction(requestId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await network.apply(deps(), s.userId, requestId, { message: str(fd, 'message'), acceptShare: fd.get('accept') === 'on', sample: await audioOf(fd, 'sample') }, await requestCtx());
    await kickDispatch();
    revalidatePath('/red', 'layout');
    return { ok: (await getTranslations('network'))('applied') };
  });
}

export async function withdrawAction(applicationId: string, requestId: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await network.withdrawApplication(deps(), s.userId, applicationId, await requestCtx());
    revalidatePath(`/red/${requestId}`);
  });
}

export async function acceptAction(applicationId: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    const collaborationId = await network.acceptApplication(deps(), s.userId, applicationId, await requestCtx());
    await kickDispatch();
    revalidatePath('/red', 'layout');
    redirect(`/red/colaboraciones/${collaborationId}`);
  });
}

export async function declineAction(applicationId: string, requestId: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await network.declineApplication(deps(), s.userId, applicationId, await requestCtx());
    await kickDispatch();
    revalidatePath(`/red/${requestId}`);
  });
}

export async function renewAction(requestId: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await network.renewRequest(deps(), s.userId, requestId, await requestCtx());
    revalidatePath('/red', 'layout');
  });
}

export async function closeRequestAction(requestId: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await network.closeRequest(deps(), s.userId, requestId, await requestCtx());
    await kickDispatch();
    revalidatePath('/red', 'layout');
  });
}

export async function sessionUrlAction(collaborationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await network.setSessionUrl(deps(), s.userId, collaborationId, str(fd, 'session'), await requestCtx());
    revalidatePath(`/red/colaboraciones/${collaborationId}`);
    return { ok: (await getTranslations('common'))('saved') };
  });
}

export async function closeSongAction(collaborationId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    const workId = await network.closeSong(deps(), s.userId, collaborationId, { title: str(fd, 'title') }, await requestCtx());
    await kickDispatch();
    revalidatePath('/', 'layout');
    redirect(`/obras/${workId}`);
  });
}

export async function profileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await profiles.updateNetworkProfile(
      deps(),
      s.userId,
      { bio: str(fd, 'bio'), languages: fd.getAll('languages').map(String), mainRole: str(fd, 'mainRole') || null, dspLinks: { spotify: str(fd, 'spotify'), apple: str(fd, 'apple'), youtube: str(fd, 'youtube') } },
      await requestCtx(),
    );
    revalidatePath('/cuenta/perfil');
    return { ok: (await getTranslations('common'))('saved') };
  });
}

export async function addCreditAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await profiles.addCredit(deps(), s.userId, { title: str(fd, 'title'), artist: str(fd, 'artist'), role: str(fd, 'role'), dspUrl: str(fd, 'link') }, await requestCtx());
    revalidatePath('/cuenta/perfil');
    return { ok: (await getTranslations('common'))('saved') };
  });
}

export async function deleteCreditAction(creditId: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await profiles.deleteCredit(deps(), s.userId, creditId, await requestCtx());
    revalidatePath('/cuenta/perfil');
  });
}
