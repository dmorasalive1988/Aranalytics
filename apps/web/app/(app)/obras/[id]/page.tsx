import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, Field, Notice, Textarea, buttonClass, cn } from '@pluma/ui';
import { AlertTriangle, Fingerprint, Lock, Scale } from 'lucide-react';
import { getWorkDetail } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { CatalogSwitch } from '@/components/catalog-switch';
import { PartyList } from '@/components/party-list';
import { StatusBadge } from '@/components/work-row';
import { date, pct } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';
import { catalogAction, newVersionAction, rejectShareAction, signShareAction } from '../actions';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireMember();
  const d = await getWorkDetail(deps(), s.userId, (await params).id);
  return { title: d?.work.title ?? '' };
}

/** A26 · Detalle de obra: estado, línea de tiempo, firmas, opt-ins, grabaciones y prueba de autoría. */
export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireMember();
  const d = await getWorkDetail(deps(), s.userId, id);
  if (!d) notFound();
  const t = await getTranslations('workDetail');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const w = d.work;

  const current = d.versions.find((v) => v.status === 'signed') ?? d.versions.find((v) => v.status === 'pending_signatures') ?? d.versions[0]!;
  const pendingNew = d.versions.find((v) => v.status === 'pending_signatures' && v.id !== current.id);
  const draftNew = d.versions.find((v) => v.status === 'draft' && w.status !== 'draft');
  const myPending = d.versions.flatMap((v) => (v.status === 'pending_signatures' ? v.parties.filter((p) => p.isMe && p.status === 'pending').map((p) => ({ ...p, versionId: v.id })) : []))[0];
  const latest = d.versions[0]!;
  const canPropose = d.isOwner && ['signed', 'rejected'].includes(latest.status);
  const pro = d.ownerPlan === 'pro';

  const reached = { draft: true, signed: ['splits_signed', 'sent_to_publisher', 'registered'].includes(w.status), sent: ['sent_to_publisher', 'registered'].includes(w.status), registered: w.status === 'registered' };
  const steps = (['draft', 'signed', 'sent', 'registered'] as const).map((k) => ({ k, done: reached[k] }));

  return (
    <>
      <BackLink href="/obras" label={tc('back')} />
      <header className="flex flex-col gap-3">
        <StatusBadge status={w.status} />
        <h1 className="font-display text-[28px] leading-tight font-extrabold tracking-[-0.02em]">{w.title}</h1>
        {w.altTitles.length > 0 && <p className="text-sm text-fg-2">{w.altTitles.join(' · ')}</p>}
      </header>

      {w.status === 'disputed' && <Notice tone="alert" icon={<Scale size={20} strokeWidth={2} />} title={t('disputed')}>{d.disputes[0]?.reason !== 'UNSIGNED_EXPIRED' ? d.disputes[0]?.reason : null}</Notice>}
      {d.conflicts.length > 0 && <Notice tone="alert" icon={<AlertTriangle size={20} strokeWidth={2} />} title={t('conflict')} />}
      {pendingNew && <Notice tone="info" title={t('pendingVersion')} />}
      {draftNew && d.isOwner && (
        <Notice tone="info" title={t('draftVersion')}>
          <Link href={`/obras/${id}/coautores`} className="font-bold">{t('continueDraft')}</Link>
        </Notice>
      )}

      {w.status === 'draft' && d.isOwner && (
        <Link href={`/obras/${id}/coautores`} className={buttonClass({ block: true })}>{t('editDraft')}</Link>
      )}

      {myPending && (
        <Card className="flex flex-col gap-4 border border-ambar">
          <p className="font-display text-lg font-extrabold">{t('yourTurn', { pct: pct(myPending.bps, locale) })}</p>
          <ActionForm action={signShareAction.bind(null, id, myPending.shareId)} submitLabel={t('sign')} pendingLabel={tc('sending')} />
          <details className="group">
            <summary className="min-h-11 cursor-pointer list-none py-2 text-center text-sm font-bold text-danger-fg">{t('reject')}</summary>
            <ActionForm action={rejectShareAction.bind(null, id, myPending.shareId)} submitLabel={t('sendReject')} submitVariant="danger" pendingLabel={tc('sending')}>
              <p className="text-sm text-fg-2">{t('rejectHint')}</p>
              <Field id="reason" label={t('reason')}>
                <Textarea id="reason" name="reason" required minLength={5} />
              </Field>
            </ActionForm>
          </details>
        </Card>
      )}

      <Card>
        <ol className="flex flex-col gap-3">
          {steps.map((st) => (
            <li key={st.k} className="flex items-center gap-3">
              <span className={cn('h-3.5 w-3.5 shrink-0 rounded-full', st.done ? 'bg-ambar' : 'border-2 border-stroke')} aria-hidden />
              <span className={st.done ? 'text-fg' : 'text-fg-2'}>{t(`timeline.${st.k}`)}</span>
            </li>
          ))}
        </ol>
      </Card>

      <section className="flex flex-col gap-2" aria-labelledby="sig-title">
        <div className="flex items-center justify-between">
          <h2 id="sig-title" className="text-[15px] font-bold">{t('signatures')} · {t('versionLabel', { n: current.version })}</h2>
          <Link href={`/obras/${id}/versiones`} className="text-sm font-bold">{t('versions')}</Link>
        </div>
        <Card className="py-2"><PartyList parties={current.parties} /></Card>
      </section>

      {canPropose && (
        <details className="rounded-[20px] bg-surface p-5">
          <summary className="min-h-11 cursor-pointer list-none py-2 font-bold">{t('newVersion')}</summary>
          <ActionForm action={newVersionAction.bind(null, id)} submitLabel={t('createVersion')} submitVariant="secondary" pendingLabel={tc('sending')}>
            <p className="text-sm text-fg-2">{t('newVersionHint')}</p>
            <Field id="reason-v" label={t('newVersionReason')}>
              <Textarea id="reason-v" name="reason" />
            </Field>
          </ActionForm>
        </details>
      )}

      {d.isOwner && (
        <section className="flex flex-col gap-2" aria-labelledby="cat-title">
          <h2 id="cat-title" className="text-[15px] font-bold">{t('catalogs')}</h2>
          <Card className="flex flex-col gap-5">
            {!pro && (
              <p className="flex items-center gap-2 text-sm text-fg-3">
                <Lock size={16} strokeWidth={2} aria-hidden />
                {t('lockedPro')} <Link href="/cuenta/plan" className="font-bold">{t('upgrade')}</Link>
              </p>
            )}
            <CatalogSwitch id="sync" label={t('sync')} hint={t('syncHint')} checked={w.syncOptIn} disabled={!pro} onToggle={catalogAction.bind(null, id, 'sync')} />
            <CatalogSwitch id="ar" label={t('ar')} hint={t('arHint')} checked={w.arOptIn} disabled={!pro || d.recordings.length > 0} onToggle={catalogAction.bind(null, id, 'ar')} />
            <CatalogSwitch id="oneStop" label={t('oneStop')} checked={w.oneStop} disabled={!pro} onToggle={catalogAction.bind(null, id, 'oneStop')} />
          </Card>
        </section>
      )}

      <section className="flex flex-col gap-2" aria-labelledby="rec-title">
        <h2 id="rec-title" className="text-[15px] font-bold">{t('recordings')}</h2>
        {d.recordings.length === 0 ? <p className="text-sm text-fg-2">{t('noRecordings')}</p> : (
          <ul className="flex flex-col">{d.recordings.map((r) => <li key={r.id} className="tabular border-b border-line py-2 text-sm last:border-0">{r.isrc}</li>)}</ul>
        )}
      </section>

      <Card className="flex items-start gap-3">
        <Fingerprint size={22} strokeWidth={2} className="mt-0.5 shrink-0 text-accent-fg" aria-hidden />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[15px] font-bold">{t('authorship')}</h2>
          <p className="text-sm text-fg-3">{w.authorshipSealedAt ? t('sealed', { date: date(w.authorshipSealedAt, locale) }) : t('notSealed')}</p>
          {(w.lyricsSha256 || w.audioSha256) && (
            <p className="tabular break-all text-xs text-fg-2">{[w.lyricsSha256 && `lyrics ${w.lyricsSha256.slice(0, 16)}…`, w.audioSha256 && `audio ${w.audioSha256.slice(0, 16)}…`].filter(Boolean).join(' · ')}</p>
          )}
        </div>
      </Card>
    </>
  );
}
