'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { DomainError, type WriterRole } from '@pluma/domain';
import {
  attachDemo,
  createWork,
  proposeNewVersion,
  rejectAsMember,
  setCatalogOptIns,
  setDraftSplit,
  signAsMember,
  submitForSignatures,
  updateWorkDraft,
  type ShareInput,
  type WorkInput,
} from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, kickDispatch, requestCtx, requireMember } from '@/lib/server';

const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

function workInput(fd: FormData): WorkInput {
  const ai = str(fd, 'ai');
  return {
    title: str(fd, 'title'),
    altTitles: list(str(fd, 'altTitles')),
    language: str(fd, 'language'),
    genre: str(fd, 'genre'),
    lyrics: str(fd, 'lyrics') || null,
    aiDeclaration: (['none', 'ai_assisted', 'ai_generated'].includes(ai) ? ai : '') as WorkInput['aiDeclaration'],
    isrcs: list(str(fd, 'isrcs').replace(/\s+/g, ',')),
  };
}

export async function createWorkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    const id = await createWork(deps(), s.userId, workInput(fd), await requestCtx());
    await kickDispatch();
    redirect(`/obras/${id}/archivos`);
  });
}

export async function updateWorkAction(workId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await updateWorkDraft(deps(), s.userId, workId, workInput(fd), await requestCtx());
    await kickDispatch();
    redirect(`/obras/${workId}/coautores`);
  });
}

export async function uploadDemoAction(workId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    const file = fd.get('demo');
    if (!(file instanceof File) || file.size === 0) throw new DomainError('AUDIO_TYPE_UNSUPPORTED');
    await attachDemo(deps(), s.userId, workId, { bytes: Buffer.from(await file.arrayBuffer()), mime: file.type }, await requestCtx());
    await kickDispatch();
    revalidatePath(`/obras/${workId}/archivos`);
    return { ok: (await getTranslations('common'))('saved') };
  });
}

export interface SplitRowPayload {
  kind: 'member' | 'external';
  userId?: string;
  name?: string;
  email?: string;
  role: WriterRole;
  bps: number;
}

export async function saveSplitsAction(workId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    const rows = JSON.parse(str(fd, 'rows') || '[]') as SplitRowPayload[];
    const shares: ShareInput[] = rows.map((r) =>
      r.kind === 'member' && r.userId === s.userId
        ? { kind: 'member', userId: s.userId, role: r.role, bps: r.bps }
        : r.kind === 'member' && r.userId
          ? { kind: 'member', userId: r.userId, role: r.role, bps: r.bps }
          : { kind: 'external', name: r.name ?? '', email: r.email ?? '', role: r.role, bps: r.bps },
    );
    await setDraftSplit(deps(), s.userId, workId, shares, await requestCtx());
    redirect(`/obras/${workId}/revisar`);
  });
}

export async function submitAction(workId: string, _: ActionState): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await submitForSignatures(deps(), s.userId, workId, await requestCtx());
    await kickDispatch();
    redirect(`/obras/${workId}`);
  });
}

export async function signShareAction(workId: string, shareId: string, _: ActionState): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await signAsMember(deps(), s.userId, shareId, await requestCtx());
    await kickDispatch();
    revalidatePath(`/obras/${workId}`);
    return { ok: (await getTranslations('workDetail'))('signed') };
  });
}

export async function rejectShareAction(workId: string, shareId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await rejectAsMember(deps(), s.userId, shareId, str(fd, 'reason'), await requestCtx());
    await kickDispatch();
    revalidatePath(`/obras/${workId}`);
  });
}

export async function newVersionAction(workId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await proposeNewVersion(deps(), s.userId, workId, str(fd, 'reason'), await requestCtx());
    redirect(`/obras/${workId}/coautores`);
  });
}

export async function catalogAction(workId: string, field: 'sync' | 'ar' | 'oneStop', value: boolean): Promise<ActionState> {
  return run(async () => {
    const s = await requireMember();
    await setCatalogOptIns(deps(), s.userId, workId, { [field]: value }, await requestCtx());
    revalidatePath(`/obras/${workId}`);
  });
}
