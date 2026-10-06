'use server';

import { inlineDispatch } from '@pluma/db/env';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { dispatchPending, payouts, statements } from '@pluma/services';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, requestCtx, requireStaff } from '@/lib/server';

const dispatch = () => {
  if (inlineDispatch()) after(() => dispatchPending(deps(), { limit: 500 }).catch((e) => console.error(e)));
};
const money = (c: number) => `USD ${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(c / 100)}`;

export async function createPeriodAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    const id = await statements.createPeriod(deps(), s.id, { code: str(fd, 'code'), payDate: str(fd, 'payDate') }, await requestCtx());
    redirect(`/statements/${id}`);
  });
}

export async function uploadAction(periodId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    const file = fd.get('file');
    if (!(file instanceof File) || file.size === 0) return { error: 'Elige un archivo.' };
    const r = await statements.uploadStatement(deps(), s.id, { periodId, fileName: file.name, bytes: Buffer.from(await file.arrayBuffer()) }, await requestCtx());
    revalidatePath(`/statements/${periodId}`);
    return { ok: `${r.lines} líneas normalizadas · ${r.matching.auto} con match automático · ${r.matching.suggested} con sugerencia · ${r.matching.unmatched} sin match${r.errors.length ? ` · ${r.errors.length} con error` : ''}.` };
  });
}

export async function fxAction(periodId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await statements.setFxRate(deps(), s.id, { base: str(fd, 'base'), rate: str(fd, 'rate').replace(',', '.'), asOf: str(fd, 'asOf'), source: str(fd, 'source') }, await requestCtx());
    revalidatePath(`/statements/${periodId}`);
    return { ok: 'Tasa registrada.' };
  });
}

export async function calculateAction(periodId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    const r = await statements.calculateRun(deps(), s.id, periodId, str(fd, 'received'), await requestCtx());
    revalidatePath(`/statements/${periodId}`);
    return r.reconciliation.balanced
      ? { ok: `Conciliación cuadrada al centavo.${r.unresolvedLines ? ` ${r.unresolvedLines} líneas sin match quedaron en suspenso.` : ''}` }
      : { error: `No cuadra: diferencia de ${money(r.reconciliation.differenceCents)}${r.reconciliation.parsedTotalCents !== r.reconciliation.controlTotalCents ? ' y el total de líneas no coincide con el de control' : ''}. La publicación queda bloqueada.` };
  });
}

export async function approveAction(periodId: string, runId: string, _: ActionState): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await statements.approveRun(deps(), s.id, runId, await requestCtx());
    revalidatePath(`/statements/${periodId}`);
  });
}

export async function testEmailAction(periodId: string, runId: string, _: ActionState): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await statements.sendTestStatementEmail(deps(), s.id, runId);
    revalidatePath(`/statements/${periodId}`);
    return { ok: `Envío de prueba a ${s.email}.` };
  });
}

export async function publishAction(periodId: string, runId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    const when = str(fd, 'when');
    if (when) {
      const at = new Date(when);
      if (Number.isNaN(at.getTime()) || at.getTime() < Date.now()) return { error: 'La hora programada debe estar en el futuro.' };
      await statements.schedulePublication(deps(), s.id, runId, at, await requestCtx());
      revalidatePath(`/statements/${periodId}`);
      return { ok: `Publicación programada para ${at.toLocaleString('es-CO', { timeZone: 'America/Bogota' })}.` };
    }
    const r = await statements.publishRun(deps(), s.id, runId, await requestCtx());
    dispatch();
    revalidatePath(`/statements/${periodId}`);
    return { ok: `Publicados ${r.published} statements. Los correos salen en el idioma de cada autor.` };
  });
}

export async function matchAction(lineId: string, workId: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await statements.manualMatch(deps(), s.id, lineId, workId, await requestCtx());
    revalidatePath('/matching');
  });
}

export async function suspenseAction(lineId: string): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await statements.sendToSuspense(deps(), s.id, lineId, await requestCtx());
    revalidatePath('/matching');
  });
}

export async function searchWorksAction(q: string) {
  await requireStaff();
  return statements.searchWorksForMatch(deps(), q);
}

export async function prepareBatchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await payouts.preparePayoutBatch(deps(), s.id, fd.getAll('ids').map(String), await requestCtx());
    revalidatePath('/pagos');
    return { ok: 'Lote armado. Falta la aprobación de otra persona.' };
  });
}

export async function approveBatchAction(batchId: string, _: ActionState): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await payouts.approvePayoutBatch(deps(), s.id, batchId, await requestCtx());
    revalidatePath('/pagos');
  });
}

export async function markSentAction(payoutId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await payouts.markPayoutSent(deps(), s.id, payoutId, str(fd, 'ref'), await requestCtx());
    dispatch();
    revalidatePath('/pagos');
  });
}

export async function failPayoutAction(payoutId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await payouts.failPayout(deps(), s.id, payoutId, str(fd, 'reason'), await requestCtx());
    revalidatePath('/pagos');
  });
}
