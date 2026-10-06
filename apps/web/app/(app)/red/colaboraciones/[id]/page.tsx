import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, Field, Input, Notice, ScreenTitle, buttonClass } from '@pluma/ui';
import { CircleCheck, Mail, Phone } from 'lucide-react';
import { network } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { pct } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';
import { closeSongAction, sessionUrlAction } from '../../actions';

export async function generateMetadata() {
  return { title: (await getTranslations('network'))('collabTitle') };
}

/** A40 · Colaboración aceptada: contactos revelados, split pre-acordado, sesión y Cerrar canción. */
export default async function Collaboration({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireMember();
  const c = await network.getCollaboration(deps(), s.userId, id);
  if (!c) notFound();
  const t = await getTranslations('network');
  const tr = await getTranslations('splits.roles');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const other = c.parties.find((p) => !p.isMe)!;
  return (
    <>
      <BackLink href="/red/colaboraciones" label={t('collaborations')} />
      <ScreenTitle eyebrow={t(`types.${c.requestType}`)} title={c.requestTitle}>{t('with', { name: other.name })}</ScreenTitle>
      {c.workId && (
        <Notice tone="ok" icon={<CircleCheck size={20} strokeWidth={2} />} title={t('closed')}>
          <Link href={`/obras/${c.workId}`} className="font-bold">{t('viewWork')}</Link>
        </Notice>
      )}
      <Card className="flex flex-col gap-3">
        <h2 className="text-xs font-bold tracking-[0.08em] text-fg-2 uppercase">{t('contacts')}</h2>
        <p className="font-display text-lg font-extrabold">{other.name}{other.city ? <span className="text-sm font-normal text-fg-2"> · {other.city}</span> : null}</p>
        <a href={`mailto:${other.email}`} className="flex min-h-11 items-center gap-2 text-[15px]"><Mail size={18} strokeWidth={2} aria-label={t('email')} /> {other.email}</a>
        {other.phone && <a href={`tel:${other.phone}`} className="flex min-h-11 items-center gap-2 text-[15px]"><Phone size={18} strokeWidth={2} aria-label={t('phone')} /> {other.phone}</a>}
      </Card>
      <Card className="flex flex-col gap-2">
        <h2 className="text-xs font-bold tracking-[0.08em] text-fg-2 uppercase">{t('split')}</h2>
        <ul className="flex flex-col">
          {c.parties.map((p) => (
            <li key={p.userId} className="flex min-h-12 items-center justify-between gap-3 border-b border-line last:border-0">
              <span className="flex flex-col">
                <span className="text-[15px] font-medium">{p.isMe ? `${p.name} (${t('you')})` : p.name}</span>
                <span className="text-xs text-fg-2">{tr(p.role)}</span>
              </span>
              <span className="tabular text-lg font-bold">{pct(p.shareBps, locale)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <ActionForm action={sessionUrlAction.bind(null, c.id)} submitLabel={t('saveSession')} submitVariant="secondary">
          <Field id="session" label={t('session')} hint={t('sessionHint')}>
            <Input id="session" name="session" type="url" inputMode="url" defaultValue={c.sessionUrl ?? ''} placeholder="https://" hasHint />
          </Field>
          {c.sessionUrl && <a href={c.sessionUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: 'outline-ambar', block: true })}>{t('session')}</a>}
        </ActionForm>
      </Card>
      {!c.workId && (
        <Card className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-extrabold">{t('closeSong')}</h2>
          <p className="text-sm text-fg-2">{t('closeHint')}</p>
          <ActionForm action={closeSongAction.bind(null, c.id)} submitLabel={t('closeSong')} pendingLabel={tc('sending')}>
            <Field id="title" label={t('workTitle')}>
              <Input id="title" name="title" defaultValue={c.requestTitle} required maxLength={200} />
            </Field>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
