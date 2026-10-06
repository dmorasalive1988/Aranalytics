import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, Field, Notice, ScreenTitle, StatusPill, Textarea, buttonClass } from '@pluma/ui';
import { CircleAlert, Lock } from 'lucide-react';
import { network, profiles } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { PersonCard } from '@/components/applicant-card';
import { BackLink } from '@/components/back-link';
import { networkGate } from '@/components/network-gate';
import { ProtectedAudio } from '@/components/protected-audio';
import { date, pct } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';
import { acceptAction, applyAction, closeRequestAction, declineAction, renewAction, withdrawAction } from '../actions';
import { languageNames } from '@/lib/languages';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireMember();
  const d = await network.getRequest(deps(), s.userId, (await params).id).catch(() => null);
  return { title: d?.request.title ?? (await getTranslations('network'))('title') };
}

const APP_TONE = { pending: 'ambar', accepted: 'verde', declined: 'niebla', expired: 'niebla', withdrawn: 'niebla' } as const;
const fileClass = 'block w-full rounded-xl border border-field-stroke bg-field px-4 py-3 text-sm text-fg file:mr-4 file:rounded-lg file:border-0 file:bg-ambar file:px-3 file:py-2 file:font-bold file:text-tinta';

/** A35 detalle · A37 postularse · A38 postulaciones recibidas (si la solicitud es propia). */
export default async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireMember();
  const gate = await networkGate(s.userId);
  if (!gate.member) return <>{gate.notice}</>;
  const d = await network.getRequest(deps(), s.userId, id);
  if (!d) notFound();
  const t = await getTranslations('network');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const r = d.request;
  const langs = languageNames(locale);
  const open = r.status === 'open' && !r.expired && !r.hiddenAt;
  const offered = pct(r.offeredShareBps, locale);
  return (
    <>
      <BackLink href={d.mine ? '/red/mis-solicitudes' : '/red'} label={t('title')} />
      <div className="flex flex-wrap gap-2">
        <StatusPill tone="outline">{t(`types.${r.type}`)}</StatusPill>
        {r.hiddenAt ? <StatusPill tone="coral">{t('status.hidden')}</StatusPill> : <StatusPill tone={open ? 'verde' : 'niebla'}>{t(`status.${r.expired && r.status === 'open' ? 'expired' : r.status}`)}</StatusPill>}
      </div>
      <ScreenTitle title={r.title} />
      <Card className="flex flex-col gap-3">
        <p className="text-[15px] leading-relaxed whitespace-pre-line">{r.description}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div><dt className="text-xs text-fg-3">{t('genre')}</dt><dd>{r.genre}{r.bpm ? ` · ${t('bpm', { bpm: r.bpm })}` : ''}</dd></div>
          <div><dt className="text-xs text-fg-3">{t('modality')}</dt><dd>{t(`modalities.${r.modality}`)}{r.city ? ` · ${r.city}` : ''}</dd></div>
          <div><dt className="text-xs text-fg-3">{t('languages')}</dt><dd>{r.languages.map((l) => langs.of(l)).join(', ')}</dd></div>
          <div><dt className="text-xs text-fg-3">{t('offered', { pct: '' }).trim()}</dt><dd className="font-bold text-accent-fg">{offered}</dd></div>
        </dl>
        {r.expiresAt && <p className="text-xs text-fg-3">{r.expired ? t('expired') : t('expiresOn', { date: date(r.expiresAt, locale) })}</p>}
      </Card>
      {r.demoFileId && (
        <Card className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-[15px] font-bold"><Lock size={16} strokeWidth={2} aria-hidden /> {t('demo')}</span>
          <ProtectedAudio fileId={r.demoFileId} label={`${t('demo')}: ${r.title}`} />
          <span className="text-xs text-fg-3">{t('demoNote')}</span>
        </Card>
      )}

      {!d.mine && (
        <>
          <section className="flex flex-col gap-2" aria-label={t('by')}>
            <h2 className="text-xs font-bold tracking-[0.08em] text-fg-2 uppercase">{t('by')}</h2>
            <PersonCard p={d.author} />
          </section>
          {d.myApplication ? (
            <Card className="flex flex-col gap-3">
              <p className="text-[15px] font-bold">{t('yourApplication', { status: t(`status.${d.myApplication.status}`) })}</p>
              {d.myApplication.status === 'pending' && <p className="text-sm text-fg-2">{t('expiresOn', { date: date(d.myApplication.expiresAt, locale) })} · {t('contactsHidden')}</p>}
              {d.myApplication.collaborationId && <Link href={`/red/colaboraciones/${d.myApplication.collaborationId}`} className={buttonClass({ block: true })}>{t('openCollab')}</Link>}
              {d.myApplication.status === 'pending' && <ActionForm action={withdrawAction.bind(null, d.myApplication.id, r.id)} submitLabel={t('withdraw')} submitVariant="ghost" />}
            </Card>
          ) : open ? (
            <section className="flex flex-col gap-3" aria-labelledby="apply">
              <h2 id="apply" className="font-display text-xl font-extrabold">{t('applyTitle')}</h2>
              {d.quota && (
                <Notice tone={d.quota.remaining ? 'info' : 'alert'} icon={d.quota.remaining ? undefined : <CircleAlert size={20} strokeWidth={2} />}
                  title={d.quota.remaining ? t('quota', { remaining: d.quota.remaining, limit: d.quota.limit }) : t('quotaEmpty', { limit: d.quota.limit, date: d.quota.nextSlotAt ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d.quota.nextSlotAt) : '' })}>
                  {gate.member.plan === 'socio' ? <Link href="/cuenta/plan" className="font-bold">{t('upgrade')}</Link> : undefined}
                </Notice>
              )}
              {d.quota?.remaining !== 0 && (
                <ActionForm action={applyAction.bind(null, r.id)} submitLabel={t('applyCta')} pendingLabel={tc('sending')}>
                  <Field id="message" label={t('message')} hint={t('messageHint')}>
                    <Textarea id="message" name="message" rows={4} maxLength={1000} required aria-describedby="message-hint" />
                  </Field>
                  <Field id="sample" label={t('sample')} hint={t('sampleHint')}>
                    <input id="sample" name="sample" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac" aria-describedby="sample-hint" className={fileClass} />
                  </Field>
                  <label className="flex items-start gap-3 rounded-xl bg-surface p-4 text-[15px]">
                    <input type="checkbox" name="accept" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ambar)]" />
                    <span>{t('accept', { pct: offered })}</span>
                  </label>
                  <p className="text-xs text-fg-3">{t('contactsHidden')}</p>
                </ActionForm>
              )}
            </section>
          ) : null}
        </>
      )}

      {d.mine && (
        <>
          {!r.hiddenAt && (r.status === 'open' || r.status === 'expired') && (
            <div className="grid grid-cols-2 gap-3">
              <ActionForm action={renewAction.bind(null, r.id)} submitLabel={t('renew')} submitVariant="secondary" />
              {r.status === 'open' && <ActionForm action={closeRequestAction.bind(null, r.id)} submitLabel={t('closeRequest')} submitVariant="ghost" />}
            </div>
          )}
          <section className="flex flex-col gap-3" aria-labelledby="applicants">
            <h2 id="applicants" className="font-display text-xl font-extrabold">{t('applicants')}</h2>
            {d.applications.length === 0 && <p className="text-sm text-fg-2">{t('noApplicants')}</p>}
            {await Promise.all(
              d.applications.map(async (a) => (
                <PersonCard key={a.applicationId} p={await profiles.publicCard(deps(), a.userId)}>
                  <blockquote className="border-l-2 border-ambar pl-3 text-[15px] italic">{a.message}</blockquote>
                  {a.sampleFileId && <ProtectedAudio fileId={a.sampleFileId} label={`${t('sample')}: ${a.name}`} />}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-fg-2">
                    <StatusPill tone={APP_TONE[a.status as keyof typeof APP_TONE] ?? 'niebla'}>{t(`status.${a.status}`)}</StatusPill>
                    <span>{t('acceptsShare', { pct: pct(a.shareBps, locale) })}</span>
                    {a.status === 'pending' && <span>{t('expiresShort', { date: date(a.expiresAt, locale) })}</span>}
                  </div>
                  {a.status === 'pending' && open && (
                    <div className="flex flex-col gap-2">
                      <ActionForm action={acceptAction.bind(null, a.applicationId)} submitLabel={t('acceptCta')} className="flex flex-col" />
                      <div className="grid grid-cols-2 gap-2">
                        <Link href={`/perfil/${a.userId}`} className={buttonClass({ variant: 'secondary' })}>{t('viewProfile')}</Link>
                        <ActionForm action={declineAction.bind(null, a.applicationId, r.id)} submitLabel={t('decline')} submitVariant="ghost" className="flex flex-col" />
                      </div>
                    </div>
                  )}
                  {a.collaborationId && <Link href={`/red/colaboraciones/${a.collaborationId}`} className={buttonClass({ block: true })}>{t('openCollab')}</Link>}
                </PersonCard>
              )),
            )}
          </section>
        </>
      )}
    </>
  );
}
