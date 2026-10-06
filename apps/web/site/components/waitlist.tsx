'use client';

import { useActionState } from 'react';
import { waitlistAction, type LeadState } from '@/app/(site)/[lang]/actions';
import type { SiteDict, SiteLang } from '../i18n';

/** Formulario de correo para lanzar con lista de espera (reemplaza a "Hazte socio" mientras está activa). */
export function WaitlistForm({ id, lang, labels, plans }: { id: string; lang: SiteLang; labels: SiteDict['waitlist']; plans: Record<'socio' | 'pro', string> }) {
  const [state, action, pending] = useActionState<LeadState, FormData>(waitlistAction, { status: 'idle' });
  return (
    <div id={id} className="flex w-full max-w-[560px] scroll-mt-24 flex-col gap-4 rounded-[24px] bg-noche p-6 text-left">
      <h3 className="font-display text-2xl font-extrabold">{labels.title}</h3>
      <p className="text-fg-3">{labels.body}</p>
      {state.status === 'ok' ? (
        <p role="status" className="rounded-2xl border border-verde bg-ok px-4 py-3 font-bold text-ok-fg">
          {labels.ok}
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="lang" value={lang} />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-fg-3">
            {labels.email}
            <input name="email" type="email" required autoComplete="email" inputMode="email" className="h-[52px] rounded-[14px] border border-field-stroke bg-tinta px-4 text-[16px] text-papel" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-fg-3">
            {labels.plan}
            <select name="plan" defaultValue="pro" className="h-[52px] rounded-[14px] border border-field-stroke bg-tinta px-4 text-[16px] text-papel">
              <option value="pro">{plans.pro}</option>
              <option value="socio">{plans.socio}</option>
            </select>
          </label>
          {state.status === 'error' && (
            <p role="alert" className="text-sm font-bold text-danger-fg">
              {labels.error}
            </p>
          )}
          <button disabled={pending} data-track="waitlist_submit" className="h-[52px] rounded-[14px] bg-ambar px-6 font-bold text-tinta hover:bg-ambar-hover disabled:opacity-60">
            {pending ? labels.sending : labels.submit}
          </button>
        </form>
      )}
    </div>
  );
}
