'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { parseSyncQuery } from '@pluma/domain/catalog';
import type { SiteDict } from '../i18n';

/** Buscador de muestra: muestra cómo Pluma Sync convierte una búsqueda en lenguaje natural en filtros. */
export function SyncSearch({ labels }: { labels: SiteDict['syncPage'] }) {
  const [q, setQ] = useState(labels.searchExamples[0]!);
  const f = parseSyncQuery(q);
  const chips: [string, string][] = [
    ...f.genres.map((g) => [labels.filters.genres, g] as [string, string]),
    ...f.moods.map((m) => [labels.filters.moods, labels.moods[m as keyof typeof labels.moods] ?? m] as [string, string]),
    ...f.languages.map((l) => [labels.filters.languages, labels.langs[l as keyof typeof labels.langs] ?? l] as [string, string]),
    ...(f.vocals ? [[labels.filters.vocals, labels.vocals[f.vocals as keyof typeof labels.vocals] ?? f.vocals] as [string, string]] : []),
    ...(f.bpmMin !== null && f.bpmMax !== null ? [[labels.filters.bpm, `${f.bpmMin}–${f.bpmMax}`] as [string, string]] : []),
    ...(f.oneStop ? [[labels.filters.oneStop, labels.yes] as [string, string]] : []),
    ...(f.instrumental && f.vocals !== 'none' ? [[labels.filters.instrumental, labels.yes] as [string, string]] : []),
    ...(f.text ? [[labels.filters.text, f.text] as [string, string]] : []),
  ];
  return (
    <div className="flex flex-col gap-5 rounded-[24px] bg-noche p-5 sm:p-8">
      <label className="flex flex-col gap-2 text-sm font-medium text-fg-3">
        {labels.searchLabel}
        <span className="relative">
          <Search size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-fg-2" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.searchPlaceholder} className="h-14 w-full rounded-[14px] border border-field-stroke bg-tinta pr-4 pl-12 text-[16px] text-papel" />
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        {labels.searchExamples.map((ex) => (
          <button key={ex} type="button" onClick={() => setQ(ex)} className="rounded-full border border-stroke px-3 py-1.5 text-xs text-fg-3 hover:border-ambar hover:text-papel">
            {ex}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3 border-t border-line pt-5" aria-live="polite">
        <p className="text-sm font-bold">{labels.searchResult}</p>
        {chips.length === 0 ? (
          <p className="text-sm text-fg-2">{labels.searchEmpty}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {chips.map(([k, v], i) => (
              <li key={i} className="inline-flex items-center gap-1.5 rounded-full bg-tinta px-3 py-1.5 text-sm">
                <span className="text-fg-2">{k}:</span>
                <strong className="font-bold text-ambar">{v}</strong>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-fg-2">{labels.searchNote}</p>
      </div>
    </div>
  );
}
