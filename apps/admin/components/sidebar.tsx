'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@pluma/ui';

export interface NavItem {
  href: string;
  label: string;
  soon?: boolean;
}

/** Barra lateral en Tinta; activo en Noche con texto Ámbar. */
export function Sidebar({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((i) => {
        const active = i.href === '/' ? path === '/' : path.startsWith(i.href);
        return (
          <li key={i.href}>
            {i.soon ? (
              <span className="flex min-h-11 items-center justify-between rounded-[10px] px-3.5 text-[#8E8BA3]">
                {i.label} <span className="text-[10px] font-bold tracking-[0.08em]">FASE B</span>
              </span>
            ) : (
              <Link href={i.href} aria-current={active ? 'page' : undefined} className={cn('flex min-h-11 items-center rounded-[10px] px-3.5 no-underline', active ? 'bg-noche font-bold text-ambar' : 'text-[#C9C6D6] hover:bg-noche')}>
                {i.label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
