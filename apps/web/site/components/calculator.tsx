'use client';

import { useId, useState } from 'react';
import { annualNetCents } from '@pluma/domain/membership';
import { NUMBER_LOCALE, fmt, type SiteLang } from '../config';
import type { SiteDict } from '../i18n';

type Plan = { priceCents: number; commissionBps: number };

const MAX = 20_000;
const STEP = 50;

/** Calculadora: neto = recaudo × (1 − comisión) − membresía, para Socio y Pro, y desde cuánto conviene Pro. */
export function Calculator({ lang, labels, plans, breakEven }: { lang: SiteLang; labels: SiteDict['pricing']['calc']; plans: { socio: Plan; pro: Plan }; breakEven: string }) {
  const [gross, setGross] = useState(1_000);
  const id = useId();
  const money = (cents: number) => {
    const n = new Intl.NumberFormat(NUMBER_LOCALE[lang], { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(Math.abs(cents) / 100);
    return `${cents < 0 ? '−' : ''}USD ${n}`;
  };
  const socio = annualNetCents(gross * 100, plans.socio);
  const pro = annualNetCents(gross * 100, plans.pro);
  const diff = pro - socio;
  const verdict = diff > 0 ? fmt(labels.betterPro, { diff: money(diff) }) : diff < 0 ? fmt(labels.betterSocio, { diff: money(-diff) }) : labels.even;
  const pct = (gross / MAX) * 100;
  return (
    <div className="flex flex-col gap-6 rounded-[24px] bg-tinta p-6 text-papel sm:p-8" data-theme="dark">
      <h3 className="font-display text-2xl font-extrabold">{labels.title}</h3>
      <div className="flex flex-col gap-3">
        <label htmlFor={id} className="flex flex-wrap items-baseline justify-between gap-2 text-[15px] text-fg-3">
          {labels.label}
          <output htmlFor={id} className="tabular font-display text-[32px] font-extrabold text-papel">
            {money(gross * 100)}
          </output>
        </label>
        <input
          id={id}
          type="range"
          min={0}
          max={MAX}
          step={STEP}
          value={gross}
          onChange={(e) => setGross(Number(e.target.value))}
          aria-valuetext={money(gross * 100)}
          className="pluma-range h-11 w-full cursor-pointer"
          style={{ ['--fill' as string]: `${pct}%` }}
        />
        <div className="flex justify-between text-xs text-fg-2" aria-hidden>
          <span>USD 0</span>
          <span>{money(MAX * 100)}</span>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3" aria-live="polite">
        {[
          ['socio', labels.socio, socio],
          ['pro', labels.pro, pro],
        ].map(([code, label, value]) => {
          const best = code === 'pro' ? diff > 0 : diff < 0;
          return (
            <div key={code as string} className={`flex flex-col gap-1 rounded-2xl p-4 ${best ? 'bg-ambar text-tinta' : 'bg-noche'}`}>
              <dt className={`text-sm ${best ? '' : 'text-fg-3'}`}>{label as string}</dt>
              <dd className="tabular font-display text-[22px] font-extrabold sm:text-[28px]">{money(value as number)}</dd>
            </div>
          );
        })}
      </dl>
      <p className="text-[17px] font-bold" aria-live="polite">
        {verdict}
      </p>
      <div className="flex flex-col gap-1 border-t border-line pt-4 text-sm text-fg-3">
        <p className="font-bold text-ambar">{breakEven}</p>
        <p>{labels.formula}</p>
        <p className="text-fg-2">{labels.disclaimer}</p>
      </div>
    </div>
  );
}
