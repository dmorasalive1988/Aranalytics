'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Music, Users, Clapperboard, Wallet } from 'lucide-react';
import { cn } from '@pluma/ui';

const ITEMS = [
  { href: '/inicio', key: 'home', Icon: Home },
  { href: '/obras', key: 'works', Icon: Music },
  { href: '/red', key: 'network', Icon: Users },
  { href: '/sync', key: 'sync', Icon: Clapperboard },
  { href: '/pagos', key: 'payments', Icon: Wallet },
] as const;

/** Navegación inferior: Inicio, Obras, Red, Sync, Pagos. Ícono de trazo + etiqueta 11 px; activo en Ámbar. */
export function BottomNav({ labels }: { labels: Record<(typeof ITEMS)[number]['key'] | 'main', string> }) {
  const path = usePathname();
  return (
    <nav aria-label={labels.main} className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-nav lg:hidden pb-[max(env(safe-area-inset-bottom),12px)] pt-2.5">
      <ul className="mx-auto flex max-w-[520px] justify-around px-2">
        {ITEMS.map(({ href, key, Icon }) => {
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-12 min-w-[62px] flex-col items-center gap-1 text-[11px] no-underline', active ? 'font-bold text-ambar' : 'text-niebla')}>
                <Icon size={22} strokeWidth={2} aria-hidden />
                {labels[key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
