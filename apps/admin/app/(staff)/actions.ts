'use server';

import { inlineDispatch } from '@pluma/db/env';
import { revalidatePath } from 'next/cache';
import { admin, dispatchPending } from '@pluma/services';
import { after } from 'next/server';
import { parseMoneyInput } from '@pluma/domain';
import { run, str, type ActionState } from '@/lib/actions';
import { deps, requestCtx, requireStaff } from '@/lib/server';

const dispatch = () => {
  if (inlineDispatch()) after(() => dispatchPending(deps()).catch(() => {}));
};

export async function kycAction(userId: string, status: 'approved' | 'rejected' | 'needs_review'): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await admin.setKycStatus(deps(), s.id, userId, status, await requestCtx());
    revalidatePath(`/autores/${userId}`);
  });
}

export async function registerAction(workId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await admin.registerWork(deps(), s.id, workId, { publisherWorkCode: str(fd, 'code'), iswc: str(fd, 'iswc') || null }, await requestCtx());
    dispatch();
    revalidatePath(`/obras/${workId}`);
    return { ok: 'Obra registrada. Se notificó a los autores.' };
  });
}

export async function exportAction(_: ActionState): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    const r = await admin.exportNewWorks(deps(), s.id, await requestCtx());
    dispatch();
    revalidatePath('/exportar');
    return r ? { ok: `Exportadas ${r.count} obras en ${r.fileName}.` } : { error: 'No hay obras con splits firmados pendientes de exportar.' };
  });
}

export async function resolveDisputeAction(disputeId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    const outcome = str(fd, 'outcome') === 'reinvite' ? 'reinvite' : 'new_version';
    await admin.resolveDispute(deps(), s.id, disputeId, { outcome, resolution: str(fd, 'resolution') }, await requestCtx());
    dispatch();
    revalidatePath('/disputas');
  });
}

export async function conflictAction(conflictId: string, status: 'dismissed' | 'escalated'): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await admin.reviewConflict(deps(), s.id, conflictId, status, await requestCtx());
    revalidatePath('/disputas');
  });
}

export async function planAction(code: 'socio' | 'pro', _: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    const pctToBps = (v: string) => Math.round(Number(v.replace(',', '.')) * 100);
    const usdToCents = (v: string) => { const n = parseMoneyInput(v); return n === null ? -1 : Math.round(Number(n) * 100); };
    await admin.updatePlan(deps(), s.id, code, {
      commissionBps: pctToBps(str(fd, 'commission')),
      amountCents: usdToCents(str(fd, 'price')),
      stripePriceId: str(fd, 'stripePriceId'),
      dailyApplications: Number(str(fd, 'daily')) || 0,
    }, await requestCtx());
    revalidatePath('/configuracion');
    return { ok: 'Plan actualizado. El cambio quedó en la auditoría.' };
  });
}

export async function grantAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    const role = str(fd, 'role') as 'operator' | 'approver' | 'super_admin';
    await admin.grantRole(deps(), s.id, str(fd, 'email'), role, await requestCtx());
    revalidatePath('/usuarios');
    return { ok: 'Rol asignado. La persona deberá activar su segundo factor.' };
  });
}

export async function revokeAction(userId: string, role: admin.StaffRole): Promise<ActionState> {
  return run(async () => {
    const s = await requireStaff();
    await admin.revokeRole(deps(), s.id, userId, role, await requestCtx());
    revalidatePath('/usuarios');
  });
}
