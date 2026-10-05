import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start px-2 text-sm font-medium text-fg-2 no-underline hover:text-fg">
      <ChevronLeft size={20} strokeWidth={2} aria-hidden />
      {label}
    </Link>
  );
}
