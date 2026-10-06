import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { HOLD_DAYS } from '@pluma/domain';
import { Card, Field, Notice, Textarea } from '@pluma/ui';
import { CircleCheck } from 'lucide-react';
import { catalog } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { CatalogCard } from '@/components/catalog-card';
import { date } from '@/lib/format';
import { deps, requirePortalRole } from '@/lib/server';
import { holdAction, interestAction } from '../../../actions';

/** C3 · Obra: ficha, extracto de letra, "Me interesa grabarla" y hold 30/60/90. */
export default async function ArWork({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePortalRole('ar_guest', `/ar/obra/${id}`);
  const v = await catalog.arWork(deps(), s.userId, id);
  if (!v) notFound();
  const t = await getTranslations('ar');
  const tc = await getTranslations('catalog');
  const locale = await getLocale();
  const pending = v.holds.find((h) => h.status === 'requested');
  return (
    <>
      <BackLink href="/ar/catalogo" label={t('catalog')} />
      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <CatalogCard item={v.work} href={`/ar/obra/${id}`} />
          {v.work.lyricsExcerpt && (
            <Card className="flex flex-col gap-2">
              <h2 className="text-xs font-bold tracking-[0.08em] text-fg-2 uppercase">{t('excerpt')}</h2>
              <p className="text-[15px] leading-relaxed whitespace-pre-line italic">{v.work.lyricsExcerpt}{v.work.lyricsExcerpt.length >= 280 ? '…' : ''}</p>
            </Card>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-extrabold">{t('interest')}</h2>
            {v.interested ? <Notice tone="ok" icon={<CircleCheck size={20} strokeWidth={2} />} title={t('interestSent')} /> : (
              <ActionForm action={interestAction.bind(null, id)} submitLabel={t('interest')}>
                <Field id="message" label={t('message')}><Textarea id="message" name="message" rows={3} maxLength={1000} /></Field>
              </ActionForm>
            )}
          </Card>
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-extrabold">{t('holdTitle')}</h2>
            <p className="text-sm text-fg-2">{t('holdHint')}</p>
            {v.work.heldUntil ? <Notice tone="info" title={t('heldUntil', { date: date(v.work.heldUntil, locale) })} /> : pending ? <Notice tone="info" title={t('holdRequested')} /> : (
              <ActionForm action={holdAction.bind(null, id)} submitLabel={t('requestHold')} submitVariant="secondary">
                <fieldset className="flex gap-2">
                  <legend className="sr-only">{t('holdTitle')}</legend>
                  {HOLD_DAYS.map((d, i) => (
                    <label key={d} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-surface-2 text-[15px]">
                      <input type="radio" name="days" value={d} defaultChecked={i === 0} className="h-4 w-4 accent-[var(--color-ambar)]" /> {t('days', { n: d })}
                    </label>
                  ))}
                </fieldset>
                <Field id="hmsg" label={t('message')}><Textarea id="hmsg" name="message" rows={2} maxLength={1000} /></Field>
              </ActionForm>
            )}
            {v.holds.filter((h) => h.status !== 'requested').map((h) => <p key={h.id} className="text-xs text-fg-3">{tc(`holdStatus.${h.status}`)} · {t('days', { n: h.durationDays })} · {date(h.createdAt, locale)}</p>)}
          </Card>
        </div>
      </div>
    </>
  );
}
