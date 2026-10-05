'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@pluma/ui';

export interface PlanCard {
  code: 'socio' | 'pro';
  name: string;
  price: string;
  perYear: string;
  commission: string;
  example: string;
  features: string[];
  recommended?: string;
}

/** A7 · Tabla comparativa como tarjetas seleccionables (radio accesible). */
export function PlanPicker({ plans, initial, legend }: { plans: PlanCard[]; initial: 'socio' | 'pro'; legend: string }) {
  const [value, setValue] = useState(initial);
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">{legend}</legend>
      {plans.map((p) => (
        <label
          key={p.code}
          className={cn(
            'relative flex cursor-pointer flex-col gap-3 rounded-[20px] border-2 bg-surface p-5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ambar',
            value === p.code ? 'border-ambar' : 'border-line',
          )}
        >
          <input type="radio" name="plan" value={p.code} checked={value === p.code} onChange={() => setValue(p.code)} className="sr-only" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-display text-2xl font-extrabold">{p.name}</span>
              <span className="text-sm text-fg-3">{p.commission}</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              {p.recommended && <span className="rounded-xl bg-ambar px-2.5 py-1 text-[11px] font-bold text-tinta">{p.recommended}</span>}
              <span className="tabular text-xl font-bold">
                {p.price} <span className="text-sm font-normal text-fg-2">{p.perYear}</span>
              </span>
            </div>
          </div>
          <ul className="flex flex-col gap-2">
            {p.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-fg-3">
                <Check size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-ok-fg" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
          <p className="tabular rounded-xl bg-bg px-3 py-2.5 text-sm text-fg">{p.example}</p>
        </label>
      ))}
    </fieldset>
  );
}
