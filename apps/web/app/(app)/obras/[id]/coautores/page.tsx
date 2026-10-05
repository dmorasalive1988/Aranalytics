import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { bpsToInput } from '@pluma/domain';
import { ScreenTitle } from '@pluma/ui';
import { getWorkDetail } from '@pluma/services';
import { BackLink } from '@/components/back-link';
import { SplitEditor, type EditorRow } from '@/components/split-editor';
import { deps, requireMember } from '@/lib/server';
import { saveSplitsAction } from '../../actions';

/** A24 · Coautores y porcentajes de la versión en borrador. */
export default async function Coauthors({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireMember();
  const d = await getWorkDetail(deps(), s.userId, id);
  if (!d || !d.isOwner) notFound();
  const draft = d.versions.find((v) => v.status === 'draft');
  if (!draft) redirect(`/obras/${id}`);
  const t = await getTranslations('splits');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const rows: EditorRow[] = draft.parties.map((p, i) => ({
    key: `r${i}`,
    kind: p.isMember ? 'member' : 'external',
    userId: p.isMember ? (p.isMe ? s.userId : undefined) : undefined,
    isMe: p.isMe,
    name: p.displayName,
    email: p.email ?? '',
    role: p.role,
    pct: bpsToInput(p.bps, locale),
  }));
  // Los socios que no son "yo" se reconocen por correo al guardar (el servidor resuelve el userId).
  for (const r of rows) if (r.kind === 'member' && !r.isMe) r.kind = 'external';
  return (
    <>
      <BackLink href={d.work.status === 'draft' ? `/obras/${id}/archivos` : `/obras/${id}`} label={tc('back')} />
      <ScreenTitle eyebrow={d.work.title} title={t('title')}>{t('sub')}</ScreenTitle>
      <SplitEditor initial={rows.sort((a, b) => Number(!!b.isMe) - Number(!!a.isMe))} action={saveSplitsAction.bind(null, id)} />
    </>
  );
}
