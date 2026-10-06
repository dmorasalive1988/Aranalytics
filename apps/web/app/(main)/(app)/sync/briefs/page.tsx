import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, Field, Input, ScreenTitle, Select, StatusPill, buttonClass } from '@pluma/ui';
import { Lock } from 'lucide-react';
import { catalog, listMyWorks } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { SyncTabs } from '@/components/sync-tabs';
import { date, money } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';
import { submitBriefAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getTranslations('syncHub'))('briefs') };
}

/** Briefs abiertos: el autor Pro envía una obra de su catálogo de sync con un clic. */
export default async function Briefs() {
  const s = await requireMember();
  const t = await getTranslations('syncHub');
  const tc = await getTranslations('catalog');
  const locale = await getLocale();
  const pro = s.membership?.plan === 'pro';
  const [briefs, works, lic, holds] = await Promise.all([catalog.openBriefs(deps(), s.userId), listMyWorks(deps(), s.userId), catalog.licensesForWriter(deps(), s.userId), catalog.holdsForOwner(deps(), s.userId)]);
  const syncWorks = works.filter((w) => w.syncOptIn && ['splits_signed', 'sent_to_publisher', 'registered'].includes(w.status));
  const m = (c: string | null) => (c ? money(Number(c), locale, s.profile?.country) : '');
  return (
    // Escritorio: tarjetas en dos columnas; título, pestañas y avisos ocupan todo el ancho.
    <div data-wide className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5 lg:*:[&:not(.card-cell)]:col-span-2">
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <SyncTabs current="briefs" counts={{ licenses: lic.filter((r) => r.status === 'awaiting_writers' && !r.my_decision).length, holds: holds.filter((h) => h.status === 'requested').length }} />
      {!pro && (
        <Card className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-fg-2"><Lock size={16} strokeWidth={2} aria-hidden /> {t('proOnly')}</span>
          <Link href="/cuenta/plan" className={buttonClass({ variant: 'outline-ambar', size: 'md' })}>{t('upgrade')}</Link>
        </Card>
      )}
      {pro && syncWorks.length === 0 && <p className="text-sm text-fg-2">{t('noSyncWorks')}</p>}
      {briefs.length === 0 && <p className="py-6 text-center text-sm text-fg-2">{t('briefsEmpty')}</p>}
      {briefs.map((b) => {
        const pending = syncWorks.filter((w) => !b.my_works.includes(w.id));
        return (
          <Card key={b.id} className="card-cell flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-bold tracking-[0.08em] text-fg-2 uppercase">{b.company}</span>
              <h2 className="font-display text-lg font-extrabold">{b.title}</h2>
            </div>
            <p className="text-sm leading-relaxed">{b.description}</p>
            <div className="flex flex-wrap gap-1.5">
              <StatusPill tone="outline">{tc(`usages.${b.usage}`)}</StatusPill>
              <StatusPill tone="outline">{tc(`territories.${b.territory}`)}</StatusPill>
              {b.moods.map((x) => <StatusPill key={x} tone="niebla">{tc.has(`moods.${x}`) ? tc(`moods.${x}`) : x}</StatusPill>)}
              {b.genres.map((x) => <StatusPill key={x} tone="niebla">{x}</StatusPill>)}
            </div>
            <p className="text-xs text-fg-3">{[b.budget_min_cents && b.budget_max_cents ? t('budget', { range: `${m(b.budget_min_cents)} – ${m(b.budget_max_cents)}` }) : null, b.deadline ? t('deadline', { date: date(b.deadline, locale) }) : null].filter(Boolean).join(' · ')}</p>
            {b.my_works.length > 0 && <p className="text-sm text-verde">{t('submitted')}: {works.filter((w) => b.my_works.includes(w.id)).map((w) => w.title).join(', ')}</p>}
            {pro && pending.length > 0 && (
              <ActionForm action={submitBriefAction.bind(null, b.id)} submitLabel={t('submit')} submitVariant="secondary">
                <Field id={`w-${b.id}`} label={t('work')}>
                  <Select id={`w-${b.id}`} name="work">{pending.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}</Select>
                </Field>
                <Field id={`n-${b.id}`} label={t('note')}><Input id={`n-${b.id}`} name="note" maxLength={500} /></Field>
              </ActionForm>
            )}
          </Card>
        );
      })}
    </div>
  );
}
