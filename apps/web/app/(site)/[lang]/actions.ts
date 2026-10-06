'use server';

import { leads } from '@pluma/services';
import { deps, kickDispatch } from '@/lib/server';

export type LeadState = { status: 'idle' | 'ok' | 'error' };

const lang = (v: FormDataEntryValue | null) => (v === 'en' || v === 'pt' ? v : 'es');
const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v : null);

/** Lista de espera del sitio: guarda el correo y avisa al equipo. El campo "website" es una trampa para bots. */
export async function waitlistAction(_: LeadState, fd: FormData): Promise<LeadState> {
  if (str(fd.get('website'))) return { status: 'ok' };
  try {
    const plan = str(fd.get('plan'));
    await leads.submitLead(deps(), { kind: 'waitlist', email: str(fd.get('email')) ?? '', lang: lang(fd.get('lang')), plan: plan === 'socio' || plan === 'pro' ? plan : null });
    await kickDispatch();
    return { status: 'ok' };
  } catch (e) {
    if (!/^LEAD_/.test((e as Error).message)) console.error('[sitio] lista de espera', e);
    return { status: 'error' };
  }
}

/** Formularios de compradores de sync y de A&Rs: guardan el contacto y avisan al equipo. */
export async function leadAction(kind: 'sync' | 'ar', _: LeadState, fd: FormData): Promise<LeadState> {
  if (str(fd.get('website'))) return { status: 'ok' };
  try {
    await leads.submitLead(deps(), {
      kind,
      email: str(fd.get('email')) ?? '',
      lang: lang(fd.get('lang')),
      name: str(fd.get('name')),
      company: str(fd.get('company')),
      role: str(fd.get('role')),
      message: str(fd.get('message')),
    });
    await kickDispatch();
    return { status: 'ok' };
  } catch (e) {
    if (!/^LEAD_/.test((e as Error).message)) console.error(`[sitio] formulario ${kind}`, e);
    return { status: 'error' };
  }
}
