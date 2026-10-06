'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SiteDict } from '../i18n';
import { Marked } from './marked';

/** Preguntas frecuentes: pestañas por tema (todas en el HTML, para buscadores) y acordeón nativo. */
export function FaqTabs({ groups }: { groups: SiteDict['faq']['groups'] }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? groups.length - 1 : (active + delta + groups.length) % groups.length;
    if (!delta && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-orientation="horizontal" onKeyDown={onKey} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {groups.map((g, i) => (
          <button
            key={g.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`faq-tab-${g.id}`}
            aria-selected={i === active}
            aria-controls={`faq-panel-${g.id}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={`h-11 shrink-0 rounded-full px-4 text-[15px] font-bold whitespace-nowrap ${i === active ? 'bg-tinta text-papel' : 'bg-white text-tinta ring-1 ring-[#D9D3C7] hover:ring-tinta'}`}
          >
            {g.label}
          </button>
        ))}
      </div>
      {groups.map((g, i) => (
        <div key={g.id} role="tabpanel" id={`faq-panel-${g.id}`} aria-labelledby={`faq-tab-${g.id}`} hidden={i !== active} className="flex flex-col">
          {(g.items as [string, string][]).map(([q, a]) => (
            <details key={q} className="group border-b border-[#D9D3C7]">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-lg font-bold [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown size={22} className="shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
              </summary>
              <p className="max-w-[760px] pb-5 text-[16px] leading-relaxed text-fg-2">
                <Marked text={a} />
              </p>
            </details>
          ))}
        </div>
      ))}
    </div>
  );
}
