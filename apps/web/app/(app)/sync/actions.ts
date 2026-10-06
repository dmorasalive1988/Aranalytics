'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { catalog } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, kickDispatch, requestCtx, requireMember } from '@/lib/server';

export async function decideLicenseAction(requestId: string, approve: boolean): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await catalog.decideLicense(deps(), s.userId, requestId, approve, await requestCtx());
    await kickDispatch();
    revalidatePath('/sync', 'layout');
  });
}

export async function decideHoldAction(holdId: string, approve: boolean, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await catalog.decideHold(deps(), s.userId, holdId, approve, str(fd, 'reason'), await requestCtx());
    await kickDispatch();
    revalidatePath('/sync', 'layout');
  });
}

export async function submitBriefAction(briefId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await catalog.submitToBrief(deps(), s.userId, briefId, str(fd, 'work'), str(fd, 'note'), await requestCtx());
    revalidatePath('/sync/briefs');
    return { ok: (await getTranslations('syncHub'))('submitted') };
  });
}

export async function catalogMetaAction(workId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    const bpm = str(fd, 'bpm');
    await catalog.updateCatalogMetadata(
      deps(),
      s.userId,
      workId,
      { bpm: bpm ? Number(bpm) : null, musicalKey: str(fd, 'key') || null, moods: fd.getAll('moods').map(String), vocals: str(fd, 'vocals') || null, instrumentalAvailable: fd.get('instrumental') === 'on', description: str(fd, 'description') || null },
      await requestCtx(),
    );
    revalidatePath(`/obras/${workId}`);
    return { ok: (await getTranslations('common'))('saved') };
  });
}
