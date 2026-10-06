'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Share, SquarePlus, Check } from 'lucide-react';
import { cn } from '@pluma/ui';

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export interface InstallLabels {
  cta: string; title: string; body: string; iosTitle: string; ios1: string; ios2: string; ios3: string; other: string; close: string;
}

/**
 * "Instala la app": en Android y computador usa el aviso de instalación del navegador; en iPhone
 * (y donde no hay aviso) muestra los pasos. No aparece si la app ya está instalada.
 */
export function InstallApp({ labels, className }: { labels: InstallLabels; className?: string }) {
  const [installed, setInstalled] = useState(true);
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as PromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  const onClick = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setPrompt(null);
      return;
    }
    dialog.current?.showModal();
  };

  return (
    <>
      <button type="button" onClick={onClick} className={cn('inline-flex min-h-11 items-center gap-2 text-sm font-bold text-accent-fg', className)}>
        <Download size={18} strokeWidth={2} aria-hidden />
        {labels.cta}
      </button>
      <dialog ref={dialog} aria-labelledby="install-title" className="m-auto w-[min(92vw,420px)] rounded-[20px] border border-stroke bg-surface p-6 text-fg backdrop:bg-black/60">
        <div className="flex flex-col gap-4">
          <h2 id="install-title" className="font-display text-2xl font-extrabold">{labels.title}</h2>
          <p className="text-sm leading-relaxed text-fg-3">{labels.body}</p>
          {ios ? (
            <>
              <h3 className="text-sm font-bold">{labels.iosTitle}</h3>
              <ol className="flex flex-col gap-3 text-sm">
                {[
                  [Share, labels.ios1],
                  [SquarePlus, labels.ios2],
                  [Check, labels.ios3],
                ].map(([Icon, text], i) => {
                  const I = Icon as typeof Share;
                  return (
                    <li key={i} className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-ambar"><I size={18} aria-hidden /></span>
                      {text as string}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <p className="text-sm leading-relaxed">{labels.other}</p>
          )}
          <form method="dialog">
            <button className="h-11 w-full rounded-xl bg-ambar font-bold text-tinta hover:bg-ambar-hover">{labels.close}</button>
          </form>
        </div>
      </dialog>
    </>
  );
}
