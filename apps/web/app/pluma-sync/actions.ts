'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { catalog } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, kickDispatch, requestCtx, requirePortalRole, requireUser } from '@/lib/server';

export async function registerBuyerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireUser('/pluma-sync/alta');
    await catalog.registerBuyer(deps(), s.userId, { company: str(fd, 'company'), companyType: str(fd, 'type'), country: str(fd, 'country') }, await requestCtx());
    redirect('/pluma-sync/buscar');
  });
}

export interface QuoteState extends ActionState {
  range?: { minCents: number; maxCents: number };
}

export async function quoteAction(_: QuoteState, fd: FormData): Promise<QuoteState> {
  try {
    const q = await catalog.quoteLicense(deps(), { usage: str(fd, 'usage'), territory: str(fd, 'territory'), termMonths: Number(str(fd, 'term')), oneStop: fd.get('oneStop') === 'on' });
    return { range: { minCents: q.minCents, maxCents: q.maxCents } };
  } catch {
    return { error: (await getTranslations('errors'))('generic') };
  }
}

export async function licenseAction(workId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requirePortalRole('sync_buyer', `/pluma-sync/obra/${workId}`);
    await catalog.requestLicense(
      deps(),
      s.userId,
      workId,
      { usage: str(fd, 'usage'), territory: str(fd, 'territory'), termMonths: Number(str(fd, 'term')), project: str(fd, 'project'), oneStop: fd.get('oneStop') === 'on', briefId: str(fd, 'brief') || null },
      await requestCtx(),
    );
    await kickDispatch();
    revalidatePath('/pluma-sync/solicitudes');
    redirect('/pluma-sync/solicitudes?enviada=1');
  });
}

const usd = (v: string) => (v.trim() ? Math.round(Number(v.replace(',', '.')) * 100) : null);

export async function briefAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requirePortalRole('sync_buyer', '/pluma-sync/briefs');
    await catalog.createBrief(
      deps(),
      s.userId,
      {
        title: str(fd, 'title'), description: str(fd, 'description'), moods: fd.getAll('moods').map(String), genres: str(fd, 'genres').split(','), languages: fd.getAll('languages').map(String),
        usage: str(fd, 'usage'), territory: str(fd, 'territory'), termMonths: Number(str(fd, 'term')) || null, budgetMinCents: usd(str(fd, 'budgetMin')), budgetMaxCents: usd(str(fd, 'budgetMax')), deadline: str(fd, 'deadline') || null,
      },
      await requestCtx(),
    );
    revalidatePath('/pluma-sync/briefs');
    return { ok: (await getTranslations('common'))('saved') };
  });
}

export async function closeBriefAction(briefId: string): Promise<ActionState> {
  return run(async () => {
    const s = await requirePortalRole('sync_buyer', '/pluma-sync/briefs');
    await catalog.closeBrief(deps(), s.userId, briefId, await requestCtx());
    revalidatePath('/pluma-sync/briefs');
  });
}
