import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, Field, Input, Notice, PlumaLogo, ScreenTitle, Textarea, buttonClass, cn } from '@pluma/ui';
import { CircleCheck, Clock, FileSignature } from 'lucide-react';
import { getGuestInvitation } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { pct } from '@/lib/format';
import { deps } from '@/lib/server';
import { guestCodeAction, guestRejectAction, guestSignAction } from './actions';

export const metadata = { robots: { index: false, follow: false }, referrer: 'no-referrer' as const };

/** B1–B5 · Firma del coautor invitado: sin cuenta, desde un enlace seguro, con código al correo. */
export default async function GuestSign({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await getGuestInvitation(deps(), token);
  const t = await getTranslations();
  const locale = await getLocale();

  const shell = (children: React.ReactNode) => (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 px-5 pb-12 pt-6">
      <div className="flex items-center justify-between gap-3">
        <PlumaLogo size={22} />
        <LocaleSwitcher current={locale} label={t('welcome.chooseLanguage')} names={{ es: t('common.languages.es'), en: t('common.languages.en'), 'pt-BR': t('common.languages.pt-BR') }} />
      </div>
      {children}
    </main>
  );

  if (!inv) return shell(<ScreenTitle title={t('guest.notFoundTitle')}>{t('guest.closedBody')}</ScreenTitle>);
  if (inv.state === 'signed')
    return shell(
      <>
        <Notice tone="ok" icon={<CircleCheck size={22} strokeWidth={2} />} title={t('guest.signedTitle')}>{t('guest.signedBody')}</Notice>
        <Card className="flex flex-col gap-3">
          <p className="text-sm text-fg-3">{t('guest.joinPitch')}</p>
          <Link href="/bienvenida" className={buttonClass({ variant: 'secondary', size: 'md' })}>{t('guest.join')}</Link>
        </Card>
      </>,
    );
  if (inv.state === 'rejected') return shell(<Notice tone="info" title={t('guest.rejectedTitle')}>{t('guest.rejectedBody')}</Notice>);
  if (inv.state === 'expired') return shell(<Notice tone="alert" icon={<Clock size={20} strokeWidth={2} />} title={t('guest.expiredTitle')}>{t('guest.expiredBody')}</Notice>);
  if (inv.state === 'closed') return shell(<Notice tone="info" title={t('guest.closedTitle')}>{t('guest.closedBody')}</Notice>);

  return shell(
    <>
      <ScreenTitle eyebrow={t('guest.invitedBy', { name: inv.inviterName })} title={t('guest.title', { title: inv.workTitle })} />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-[20px] bg-ambar p-4 text-tinta">
          <span className="text-[13px] font-medium">{t('guest.yourShare')}</span>
          <span className="tabular text-[32px] font-bold tracking-[-0.02em]">{pct(inv.myBps, locale)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-[20px] bg-surface p-4">
          <span className="text-[13px] text-fg-2">{t('guest.yourRole')}</span>
          <span className="text-lg font-bold">{t(`splits.roles.${inv.myRole}`)}</span>
        </div>
      </div>
      <Card className="flex flex-col gap-1">
        <h2 className="text-xs font-bold tracking-[0.1em] text-fg-2 uppercase">{t('guest.fullSplit')}</h2>
        <ul className="flex flex-col">
          {inv.parties.map((p, i) => (
            <li key={i} className={cn('flex items-center justify-between gap-3 border-b border-line py-3 last:border-0', p.isMe && 'font-bold')}>
              <span className="flex flex-col">
                <span>{p.isMe ? t('common.you') : p.displayName}</span>
                <span className="text-xs font-normal text-fg-2">{t(`splits.roles.${p.role}`)}</span>
              </span>
              <span className="flex flex-col items-end">
                <span className="tabular">{pct(p.bps, locale)}</span>
                <span className={cn('text-xs font-bold', p.status === 'signed' ? 'text-ok-fg' : 'text-danger-fg')}>{p.status === 'signed' ? t('workDetail.signed') : t('workDetail.pending')}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-sm leading-relaxed text-fg-3">{t('guest.noAccount')}</p>
      <ActionForm action={guestCodeAction.bind(null, token)} submitLabel={t('guest.sendCode')} submitVariant="secondary" pendingLabel={t('common.sending')} />
      <ActionForm action={guestSignAction.bind(null, token)} submitLabel={t('guest.sign')} pendingLabel={t('common.sending')}>
        <Field id="code" label={t('guest.code')}>
          <Input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required className="text-center text-2xl tracking-[0.4em] tabular" />
        </Field>
      </ActionForm>
      <details>
        <summary className="min-h-11 cursor-pointer list-none py-2 text-center text-sm font-bold text-danger-fg">{t('guest.reject')}</summary>
        <ActionForm action={guestRejectAction.bind(null, token)} submitLabel={t('guest.sendReject')} submitVariant="danger" pendingLabel={t('common.sending')}>
          <Field id="reason" label={t('guest.reason')}>
            <Textarea id="reason" name="reason" required minLength={5} />
          </Field>
          <Field id="code-r" label={t('guest.code')}>
            <Input id="code-r" name="code" inputMode="numeric" maxLength={6} required className="tabular" />
          </Field>
        </ActionForm>
      </details>
      {inv.sheetSha256 && (
        <p className="flex items-start gap-2 break-all text-xs text-fg-2">
          <FileSignature size={14} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
          {t('guest.document')}: {inv.sheetSha256}
        </p>
      )}
    </>,
  );
}
