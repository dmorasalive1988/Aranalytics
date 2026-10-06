import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, ScreenTitle, buttonClass } from '@pluma/ui';
import { Banknote, BellOff, FileSignature, Music2, Settings2, UserRound } from 'lucide-react';
import { notifications } from '@pluma/services';
import { deps, requireMember } from '@/lib/server';
import { markAllReadAction } from './actions';

export async function generateMetadata() {
  return { title: (await getTranslations('common'))('notifications') };
}

const ICON = { money: Banknote, splits: FileSignature, works: Music2, membership: UserRound } as const;

/** A49 · Centro de notificaciones: todo lo que llegó por correo, push o WhatsApp, también aquí. */
export default async function Inbox({ searchParams }: { searchParams: Promise<{ antes?: string }> }) {
  const s = await requireMember();
  const { antes } = await searchParams;
  const t = await getTranslations('inbox');
  const locale = await getLocale();
  const { items, next } = await notifications.inbox(deps(), s.userId, { before: antes, limit: 30 });
  const unread = items.some((i) => !i.read);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const when = (iso: string) => {
    const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
    if (Math.abs(mins) < 60) return rtf.format(mins, 'minute');
    if (Math.abs(mins) < 60 * 24) return rtf.format(Math.round(mins / 60), 'hour');
    if (Math.abs(mins) < 60 * 24 * 7) return rtf.format(Math.round(mins / 1440), 'day');
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  };
  return (
    <>
      <ScreenTitle title={t('title')} />
      <div className="flex flex-wrap gap-2.5">
        {unread && (
          <form action={markAllReadAction}>
            <button className={buttonClass({ variant: 'secondary', size: 'md' })}>{t('markAll')}</button>
          </form>
        )}
        <Link href="/cuenta/notificaciones" className={buttonClass({ variant: 'ghost', size: 'md' })}>
          <Settings2 size={18} strokeWidth={2} aria-hidden /> {t('settings')}
        </Link>
      </div>
      {items.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 py-10 text-center">
          <BellOff size={28} strokeWidth={2} className="text-fg-3" aria-hidden />
          <p className="text-[15px] font-bold">{t('empty')}</p>
          <p className="text-sm text-fg-2">{t('emptyBody')}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={t('title')}>
          {items.map((i) => {
            const Icon = ICON[i.category as keyof typeof ICON] ?? Music2;
            return (
              <li key={i.id}>
                <Link href={`/notificaciones/abrir/${i.id}`} className={`flex items-start gap-3 rounded-[20px] px-4 py-3.5 text-fg no-underline ${i.read ? 'bg-surface/60' : 'bg-surface'}`}>
                  <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${i.read ? 'bg-surface-2 text-fg-3' : 'bg-ambar text-tinta'}`}>
                    <Icon size={18} strokeWidth={2} aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={`text-[15px] ${i.read ? 'font-medium text-fg-2' : 'font-bold'}`}>
                      {!i.read && <span className="sr-only">{t('unread')}: </span>}
                      {i.title}
                    </span>
                    <span className="text-sm text-fg-3">{i.body}</span>
                    <span className="text-xs text-fg-3">{when(i.createdAt)}</span>
                  </span>
                  {!i.read && <span aria-hidden className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-coral" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {next && (
        <Link href={`/notificaciones?antes=${encodeURIComponent(next)}`} className={buttonClass({ variant: 'secondary', block: true })}>
          {t('older')}
        </Link>
      )}
    </>
  );
}
