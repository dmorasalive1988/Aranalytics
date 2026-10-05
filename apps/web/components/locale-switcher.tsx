'use client';

import { useTransition } from 'react';
import { chipClass } from '@pluma/ui';
import { changeLocale } from '@/app/locale-action';

const LOCALES = [
  { code: 'es', short: 'ES' },
  { code: 'en', short: 'EN' },
  { code: 'pt-BR', short: 'PT' },
] as const;

/** Selector ES · EN · PT: guarda la cookie (y el perfil si hay sesión). */
export function LocaleSwitcher({ current, names, label }: { current: string; names: Record<string, string>; label: string }) {
  const [pending, start] = useTransition();
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={current === l.code}
          aria-label={names[l.code]}
          disabled={pending}
          onClick={() => start(() => changeLocale(l.code))}
          className={`${chipClass(current === l.code)} h-11 min-w-12 rounded-[22px]`}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
