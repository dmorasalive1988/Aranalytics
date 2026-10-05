import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Field, Notice, ScreenTitle, buttonClass } from '@pluma/ui';
import { FileAudio } from 'lucide-react';
import { getWorkDetail } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { deps, requireMember } from '@/lib/server';
import { uploadDemoAction } from '../../actions';

/** A23 · Demo de audio (opcional). */
export default async function Files({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireMember();
  const d = await getWorkDetail(deps(), s.userId, id);
  if (!d || !d.isOwner) notFound();
  const t = await getTranslations('files');
  const tc = await getTranslations('common');
  const demo = d.files.find((f) => f.kind === 'demo_original' && f.sha256 === d.work.audioSha256);
  return (
    <>
      <BackLink href={`/obras/${id}`} label={tc('back')} />
      <ScreenTitle eyebrow={d.work.title} title={t('title')}>{t('sub')}</ScreenTitle>
      {demo && <Notice tone="ok" icon={<FileAudio size={20} strokeWidth={2} />} title={t('uploaded', { hash: `${demo.sha256.slice(0, 12)}…` })} />}
      <ActionForm action={uploadDemoAction.bind(null, id)} submitLabel={t('upload')} submitVariant="secondary" pendingLabel={tc('sending')}>
        <Field id="demo" label={t('label')} hint={t('hint')}>
          <input id="demo" name="demo" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac" aria-describedby="demo-hint"
            className="block w-full rounded-xl border border-field-stroke bg-field px-4 py-3 text-sm text-fg file:mr-4 file:rounded-lg file:border-0 file:bg-ambar file:px-3 file:py-2 file:font-bold file:text-tinta" />
        </Field>
      </ActionForm>
      <Link href={`/obras/${id}/coautores`} className={buttonClass({ block: true })}>{t('continue')}</Link>
    </>
  );
}
