'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';

export const NOTIFICATIONS_SEEN = 'pluma:notifications-seen';

/** Campana con contador. El centro de notificaciones avisa al abrirse y el número desaparece al instante. */
export function NotificationBell({ count, labels }: { count: number; labels: { none: string; some: string } }) {
  const [n, setN] = useState(count);
  useEffect(() => setN(count), [count]);
  useEffect(() => {
    const seen = () => setN(0);
    window.addEventListener(NOTIFICATIONS_SEEN, seen);
    return () => window.removeEventListener(NOTIFICATIONS_SEEN, seen);
  }, []);
  return (
    <Link href="/notificaciones" aria-label={n ? labels.some.replace('{count}', String(n)) : labels.none} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-fg">
      <Bell size={22} strokeWidth={2} aria-hidden />
      {n > 0 && (
        <span aria-hidden className="tabular absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-coral px-1 text-[11px] font-bold text-tinta">
          {n > 9 ? '9+' : n}
        </span>
      )}
    </Link>
  );
}

/** Marca todo como visto al abrir el centro (las no leídas siguen resaltadas en esta visita). */
export function MarkSeen({ action }: { action: () => Promise<void> }) {
  useEffect(() => {
    action().then(() => window.dispatchEvent(new Event(NOTIFICATIONS_SEEN)));
  }, [action]);
  return null;
}
