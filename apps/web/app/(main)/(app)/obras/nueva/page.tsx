import { getTranslations } from 'next-intl/server';
import { ScreenTitle } from '@pluma/ui';
import { BackLink } from '@/components/back-link';
import { WorkForm } from '@/components/work-form';
import { requireMember } from '@/lib/server';
import { createWorkAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getTranslations('workForm'))('newTitle') };
}

/** A22 · Nueva obra. */
export default async function NewWork() {
  await requireMember();
  const t = await getTranslations('workForm');
  const tc = await getTranslations('common');
  return (
    <>
      <BackLink href="/obras" label={tc('back')} />
      <ScreenTitle title={t('newTitle')}>{t('sub')}</ScreenTitle>
      <WorkForm action={createWorkAction} submitLabel={t('create')} />
    </>
  );
}
