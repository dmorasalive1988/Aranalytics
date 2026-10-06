'use client';

import { useActionState } from 'react';
import { leadAction, type LeadState } from '@/app/(site)/[lang]/actions';
import type { SiteLang } from '../config';
import type { SiteDict } from '../i18n';

const field = 'h-[52px] w-full rounded-[14px] border border-field-stroke bg-tinta px-4 text-[16px] text-papel';

/** Formulario de contacto del sitio (compradores de sync o A&Rs): guarda el contacto y avisa al equipo. */
export function LeadForm({ kind, lang, labels }: { kind: 'sync' | 'ar'; lang: SiteLang; labels: SiteDict['forms'] }) {
  const [state, action, pending] = useActionState<LeadState, FormData>(leadAction.bind(null, kind), { status: 'idle' });
  if (state.status === 'ok') {
    return (
      <p role="status" className="rounded-2xl border border-verde bg-ok px-4 py-3 font-bold text-ok-fg">
        {labels.ok}
      </p>
    );
  }
  const label = 'flex flex-col gap-1.5 text-sm font-medium text-fg-3';
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="lang" value={lang} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label className={label}>
        {labels.name}
        <input name="name" required autoComplete="name" maxLength={120} className={field} />
      </label>
      <label className={label}>
        {labels.email}
        <input name="email" type="email" required autoComplete="email" inputMode="email" className={field} />
      </label>
      <label className={label}>
        {kind === 'ar' ? labels.labelCompany : labels.company}
        <input name="company" autoComplete="organization" maxLength={160} className={field} />
      </label>
      <label className={label}>
        {labels.role}
        <input name="role" autoComplete="organization-title" maxLength={120} className={field} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        {labels.message}
        <textarea name="message" rows={4} maxLength={2000} placeholder={kind === 'ar' ? labels.arMessagePh : labels.syncMessagePh} className="w-full rounded-[14px] border border-field-stroke bg-tinta px-4 py-3 text-[16px] text-papel" />
      </label>
      {state.status === 'error' && (
        <p role="alert" className="text-sm font-bold text-danger-fg sm:col-span-2">
          {labels.error}
        </p>
      )}
      <button disabled={pending} data-track={`${kind}_form_submit`} className="h-[52px] rounded-[14px] bg-ambar px-6 font-bold text-tinta hover:bg-ambar-hover disabled:opacity-60 sm:col-span-2 sm:justify-self-start">
        {pending ? labels.sending : labels.send}
      </button>
    </form>
  );
}
