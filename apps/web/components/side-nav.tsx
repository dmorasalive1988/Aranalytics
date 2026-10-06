'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Clapperboard, Home, Music, Users, Wallet } from 'lucide-react';
import { PlumaLogo, cn } from '@pluma/ui';

const ITEMS = [
  { href: '/inicio', key: 'home', Icon: Home },
  { href: '/obras', key: 'works', Icon: Music },
  { href: '/red', key: 'network', Icon: Users },
  { href: '/sync', key: 'sync', Icon: Clapperboard },
  { href: '/pagos', key: 'payments', Icon: Wallet },
  { href: '/analitica', key: 'analytics', Icon: BarChart3 },
] as const;

/** Barra lateral de escritorio (≥ 1024 px): mismas secciones que la navegación inferior, más Analítica (solo Pro). */
export function SideNav({ labels, footer, analytics }: { labels: Record<(typeof ITEMS)[number]['key'] | 'main', string>; footer: React.ReactNode; analytics: boolean }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line bg-nav px-4 py-6 lg:flex">
      <Link href="/inicio" aria-label="Pluma" className="px-3 no-underline">
        <PlumaLogo size={24} />
      </Link>
      <nav aria-label={labels.main}>
        <ul className="flex flex-col gap-1">
          {ITEMS.filter((i) => analytics || i.key !== 'analytics').map(({ href, key, Icon }) => {
            const active = path === href || path.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] no-underline', active ? 'bg-surface font-bold text-ambar' : 'text-niebla hover:bg-surface hover:text-fg')}
                >
                  <Icon size={20} strokeWidth={2} aria-hidden />
                  {labels[key]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto flex flex-col gap-3 px-3">{footer}</div>
    </aside>
  );
}
