import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, ScreenTitle, StatusPill } from '@pluma/ui';
import { getWorkDetail } from '@pluma/services';
import { BackLink } from '@/components/back-link';
import { PartyList } from '@/components/party-list';
import { date } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';

const TONE = { draft: 'outline', pending_signatures: 'coral', signed: 'verde', rejected: 'coral', superseded: 'niebla' } as const;

/** A27 · Historial versionado de splits, con la huella del documento firmado. */
export default async function Versions({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireMember();
  const d = await getWorkDetail(deps(), s.userId, id);
  if (!d) notFound();
  const t = await getTranslations();
  const locale = await getLocale();
  return (
    <>
      <BackLink href={`/obras/${id}`} label={t('common.back')} />
      <ScreenTitle eyebrow={d.work.title} title={t('workDetail.versions')} />
      {d.versions.map((v) => (
        <Card key={v.id} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-extrabold">{t('workDetail.versionLabel', { n: v.version })}</h2>
            <StatusPill tone={TONE[v.status]}>{v.status === 'signed' ? t('workDetail.signed') : v.status === 'pending_signatures' ? t('workDetail.pending') : v.status === 'rejected' ? t('workDetail.rejected') : v.status === 'draft' ? t('works.status.draft') : '—'}</StatusPill>
          </div>
          {v.changeReason && <p className="text-sm text-fg-3">{v.changeReason}</p>}
          {v.effectiveFrom && <p className="text-xs text-fg-2">{date(v.effectiveFrom, locale)}</p>}
          <PartyList parties={v.parties} showStatus={v.status !== 'draft'} />
          {v.splitSheetSha256 && <p className="tabular break-all text-xs text-fg-2">{t('guest.document')}: {v.splitSheetSha256}</p>}
        </Card>
      ))}
    </>
  );
}
