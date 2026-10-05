import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BPS_TOTAL } from '@pluma/domain';
import { Card, Notice, ScreenTitle } from '@pluma/ui';
import { CircleAlert, Fingerprint } from 'lucide-react';
import { getWorkDetail } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { PartyList } from '@/components/party-list';
import { deps, requireMember } from '@/lib/server';
import { submitAction } from '../../actions';

/** A25 · Revisar y enviar a firma. */
export default async function Review({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireMember();
  const d = await getWorkDetail(deps(), s.userId, id);
  if (!d || !d.isOwner) notFound();
  const draft = d.versions.find((v) => v.status === 'draft');
  if (!draft) redirect(`/obras/${id}`);
  const t = await getTranslations('review');
  const tc = await getTranslations('common');
  const tw = await getTranslations('workForm');
  const total = draft.parties.reduce((a, p) => a + p.bps, 0);
  return (
    <>
      <BackLink href={`/obras/${id}/coautores`} label={tc('back')} />
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-[0.1em] text-fg-2 uppercase">{t('work')}</h2>
          {d.work.status === 'draft' && <Link href={`/obras/${id}/editar`} className="text-sm font-bold">{t('editWork')}</Link>}
        </div>
        <p className="font-display text-xl font-extrabold">{d.work.title}</p>
        <p className="text-sm text-fg-3">{[d.work.genre, tw(`languages.${(['es', 'en', 'pt'].includes(d.work.language) ? d.work.language : 'other') as 'es'}`), d.recordings.map((r) => r.isrc).join(', ')].filter(Boolean).join(' · ')}</p>
      </Card>
      <Card className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold tracking-[0.1em] text-fg-2 uppercase">{t('splits')}</h2>
          <Link href={`/obras/${id}/coautores`} className="text-sm font-bold">{t('editSplits')}</Link>
        </div>
        <PartyList parties={draft.parties} showStatus={false} />
      </Card>
      <Card className="flex items-start gap-3">
        <Fingerprint size={22} strokeWidth={2} className="mt-0.5 shrink-0 text-accent-fg" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 className="text-[15px] font-bold">{t('authorship')}</h2>
          <p className="text-sm text-fg-3">{t('authorshipBody')}</p>
        </div>
      </Card>
      {total !== BPS_TOTAL ? (
        <Notice tone="alert" icon={<CircleAlert size={20} strokeWidth={2} />} title={t('notReady')} />
      ) : (
        <ActionForm action={submitAction.bind(null, id)} submitLabel={t('submit')} pendingLabel={tc('sending')} />
      )}
    </>
  );
}
