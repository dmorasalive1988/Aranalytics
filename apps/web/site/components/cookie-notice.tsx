'use client';

import { useEffect, useState } from 'react';
import { LEGAL_SLUGS, type SiteLang } from '../config';
import type { SiteDict } from '../i18n';

const KEY = 'pluma-site-notice';

/** Aviso informativo: la analítica no usa cookies, así que no hay nada que aceptar o rechazar. */
export function CookieNotice({ lang, labels }: { lang: SiteLang; labels: SiteDict['cookies'] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(KEY) !== '1');
    } catch {
      setOpen(true);
    }
  }, []);
  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {}
    setOpen(false);
  };
  return (
    <div role="region" aria-label={labels.more} className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-[560px] flex-col gap-3 rounded-2xl border border-stroke bg-noche p-4 text-sm text-papel sm:flex-row sm:items-center">
      <p className="flex-1 leading-relaxed text-fg-3">
        {labels.text}{' '}
        <a href={`/${lang}/${LEGAL_SLUGS[lang].privacy}`} className="font-bold">
          {labels.more}
        </a>
      </p>
      <button type="button" onClick={close} className="h-11 shrink-0 rounded-xl bg-ambar px-4 font-bold text-tinta hover:bg-ambar-hover">
        {labels.ok}
      </button>
    </div>
  );
}
