'use client';

import { useActionState } from 'react';
import { Button } from '@pluma/ui';
import type { QuoteState } from '@/app/(main)/pluma-sync/actions';

/** D5 · Cotizador: uso, territorio y plazo → rango referencial, sin recargar la página. */
export function QuoteForm({
  action,
  locale,
  options,
  labels,
  oneStopAvailable,
}: {
  action: (s: QuoteState, fd: FormData) => Promise<QuoteState>;
  locale: string;
  options: { usages: [string, string][]; territories: [string, string][]; terms: [number, string][] };
  labels: Record<'usage' | 'territory' | 'term' | 'includeMaster' | 'quoteCta' | 'range' | 'referential', string>;
  oneStopAvailable: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const fmt = (c: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'code', maximumFractionDigits: 0 }).format(c / 100);
  const field = 'h-11 rounded-xl border border-field-stroke bg-field px-3 text-[15px] text-fg';
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="grid gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{labels.usage}<select name="usage" className={field}>{options.usages.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{labels.territory}<select name="territory" className={field}>{options.territories.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{labels.term}<select name="term" defaultValue="12" className={field}>{options.terms.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </div>
      {oneStopAvailable && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="oneStop" className="h-5 w-5 accent-[var(--color-ambar)]" />{labels.includeMaster}</label>}
      <Button type="submit" variant="secondary" disabled={pending} aria-busy={pending}>{labels.quoteCta}</Button>
      <div aria-live="polite">
        {state.range && (
          <p className="flex flex-col gap-0.5">
            <span className="text-xs text-fg-2">{labels.range}</span>
            <span className="tabular font-display text-2xl font-extrabold text-accent-fg">{fmt(state.range.minCents)} – {fmt(state.range.maxCents)}</span>
          </p>
        )}
        {state.error && <p role="alert" className="text-sm text-danger-fg">{state.error}</p>}
      </div>
      <p className="text-xs text-fg-3">{labels.referential}</p>
    </form>
  );
}
