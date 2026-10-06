'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Menu, X } from 'lucide-react';

/** Menú del celular: secciones, iniciar sesión e idioma. Se cierra al elegir una sección o con Escape. */
export function MobileMenu({ labels, links, children }: { labels: { open: string; close: string; login: string; main: string }; links: { href: string; label: string }[]; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="menu-movil"
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-noche text-papel"
      >
        {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
      </button>
      <div id="menu-movil" hidden={!open} className="absolute inset-x-0 top-16 border-b border-line bg-tinta px-5 pt-2 pb-6">
        <nav aria-label={labels.main}>
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center border-b border-line font-display text-xl font-bold text-papel no-underline">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a href="/entrar" className="flex min-h-12 items-center border-b border-line font-display text-xl font-bold text-ambar no-underline">
                {labels.login}
              </a>
            </li>
          </ul>
        </nav>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
