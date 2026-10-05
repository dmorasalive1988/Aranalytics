'use client';

import { useOptimistic, useTransition, useState } from 'react';
import { Switch } from '@pluma/ui';

/** A31 · Interruptor de catálogo con actualización optimista; muestra el error si el servidor lo rechaza. */
export function CatalogSwitch({ id, label, hint, checked, disabled, onToggle }: { id: string; label: string; hint?: string; checked: boolean; disabled?: boolean; onToggle: (v: boolean) => Promise<{ error?: string }> }) {
  const [optimistic, setOptimistic] = useOptimistic(checked);
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={id} className="flex flex-col gap-0.5">
          <span className="text-[15px] font-medium">{label}</span>
          {hint && <span className="text-xs leading-relaxed text-fg-2">{hint}</span>}
        </label>
        <Switch
          id={id}
          label={label}
          checked={optimistic}
          disabled={disabled}
          onCheckedChange={(v) =>
            start(async () => {
              setError(null);
              setOptimistic(v);
              const r = await onToggle(v);
              if (r.error) setError(r.error);
            })
          }
        />
      </div>
      {error && <p role="alert" className="text-xs font-medium text-danger-fg">{error}</p>}
    </div>
  );
}
