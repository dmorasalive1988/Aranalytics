import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ScreenTitle } from '@pluma/ui';
import { getWorkDetail } from '@pluma/services';
import { BackLink } from '@/components/back-link';
import { WorkForm } from '@/components/work-form';
import { deps, requireMember } from '@/lib/server';
import { updateWorkAction } from '../../actions';

/** A22 · Editar una obra en borrador. */
export default async function EditWork({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireMember();
  const d = await getWorkDetail(deps(), s.userId, id);
  if (!d) notFound();
  if (!d.isOwner || d.work.status !== 'draft') redirect(`/obras/${id}`);
  const t = await getTranslations('workForm');
  const tc = await getTranslations('common');
  return (
    <>
      <BackLink href={`/obras/${id}/revisar`} label={tc('back')} />
      <ScreenTitle title={t('editTitle')} />
      <WorkForm action={updateWorkAction.bind(null, id)} submitLabel={tc('save')} defaults={{ ...d.work, isrcs: d.recordings.map((r) => r.isrc) }} />
    </>
  );
}
