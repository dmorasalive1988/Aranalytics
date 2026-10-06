'use client';

import { useEffect } from 'react';

type Va = (event: 'event', data: { name: string; data?: Record<string, string> }) => void;

/**
 * Mejoras progresivas del sitio: aparición al hacer scroll y eventos de conversión
 * (clics en elementos con data-track) para la analítica sin cookies.
 */
export function Enhancements() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    let io: IntersectionObserver | null = null;
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((el) => el.classList.add('is-in'));
    } else {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.classList.add('is-in');
            io?.unobserve(e.target);
          }
        },
        { rootMargin: '0px 0px -8% 0px' },
      );
      items.forEach((el) => io!.observe(el));
    }

    const onClick = (ev: MouseEvent) => {
      const el = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-track]');
      if (!el) return;
      const w = window as unknown as { va?: Va; vaq?: unknown[] };
      w.va ??= (...args) => {
        (w.vaq ??= []).push(args);
      };
      const [name, plan] = el.dataset.track!.split(':');
      w.va('event', { name: name!, data: { ...(plan ? { plan } : {}), lang: document.documentElement.lang } });
    };
    document.addEventListener('click', onClick);
    return () => {
      io?.disconnect();
      document.removeEventListener('click', onClick);
    };
  }, []);
  return null;
}
