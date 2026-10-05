'use client';

import { useState } from 'react';
import { Field, Input, chipClass } from '@pluma/ui';

/** Opciones de sociedad como chips grandes; "Otra" muestra el campo de nombre. */
export function SocietyFields({ societies, initial, labels }: { societies: string[]; initial: string; labels: { label: string; other: string; otherName: string; none: string; noneHint: string; initialOther: string } }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-[13px] font-medium text-fg-3">{labels.label}</legend>
        <div className="flex flex-wrap gap-2">
          {[...societies, 'OTHER'].map((s) => (
            <label key={s} className={`${chipClass(value === s)} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ambar`}>
              <input type="radio" name="society" value={s} checked={value === s} onChange={() => setValue(s)} className="sr-only" />
              {s === 'OTHER' ? labels.other : s}
            </label>
          ))}
        </div>
        <label className={`${chipClass(value === 'NONE')} cursor-pointer self-start has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ambar`}>
          <input type="radio" name="society" value="NONE" checked={value === 'NONE'} onChange={() => setValue('NONE')} className="sr-only" />
          {labels.none}
        </label>
        {value === 'NONE' && <p className="text-sm text-fg-2">{labels.noneHint}</p>}
      </fieldset>
      {value === 'OTHER' && (
        <Field id="otherName" label={labels.otherName}>
          <Input id="otherName" name="otherName" defaultValue={labels.initialOther} required />
        </Field>
      )}
    </>
  );
}
