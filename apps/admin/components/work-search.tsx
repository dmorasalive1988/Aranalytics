'use client';

import { useState, useTransition } from 'react';
import { Input, buttonClass } from '@pluma/ui';

/** Búsqueda de obra para el match manual. */
export function WorkSearch({ lineId, search, match }: { lineId: string; search: (q: string) => Promise<{ id: string; title: string; code: string | null }[]>; match: (lineId: string, workId: string) => Promise<{ error?: string }> }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; title: string; code: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <label className="sr-only" htmlFor={`s-${lineId}`}>Buscar obra</label>
      <Input id={`s-${lineId}`} value={q} placeholder="Buscar por título, código o ISWC" onChange={(e) => { setQ(e.target.value); start(async () => setResults(await search(e.target.value))); }} className="h-10 text-sm" />
      {results.map((r) => (
        <button key={r.id} type="button" disabled={pending} className={buttonClass({ variant: 'secondary', size: 'md' }) + ' justify-start'} onClick={() => start(async () => { const x = await match(lineId, r.id); if (x.error) setError(x.error); })}>
          {r.title} {r.code && <span className="text-xs text-fg-2">{r.code}</span>}
        </button>
      ))}
      {error && <p role="alert" className="text-xs text-danger-fg">{error}</p>}
    </div>
  );
}
