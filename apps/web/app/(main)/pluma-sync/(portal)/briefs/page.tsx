import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { LICENSE_USAGES, MOODS, TERMS, TERRITORIES } from '@pluma/domain';
import { Field, Input, ScreenTitle, Select, StatusPill, Textarea, buttonClass } from '@pluma/ui';
import { catalog } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { CatalogCard } from '@/components/catalog-card';
import { languageNames } from '@/lib/languages';
import { deps, requirePortalRole } from '@/lib/server';
import { briefAction, closeBriefAction } from '../../actions';

/** D8 · Publicar brief y ver las obras que envían los autores Pro. */
export default async function BuyerBriefsPage() {
  const s = await requirePortalRole('sync_buyer', '/pluma-sync/briefs');
  const t = await getTranslations('plumaSync');
  const tc = await getTranslations('catalog');
  const locale = await getLocale();
  const langs = languageNames(locale);
  const briefs = await catalog.buyerBriefs(deps(), s.userId);
  return (
    <>
      <ScreenTitle title={t('briefsTitle')} />
      <details className="rounded-[20px] bg-surface px-5 py-3" open={briefs.length === 0}>
        <summary className="min-h-10 cursor-pointer content-center font-bold">{t('create')}</summary>
        <ActionForm action={briefAction} submitLabel={t('publish')}>
          <Field id="title" label={t('titleLabel')}><Input id="title" name="title" required maxLength={160} /></Field>
          <Field id="description" label={t('description')}><Textarea id="description" name="description" rows={3} required maxLength={2000} /></Field>
          <div className="grid gap-3 md:grid-cols-3">
            <Field id="usage" label={t('usage')}><Select id="usage" name="usage">{LICENSE_USAGES.map((u) => <option key={u} value={u}>{tc(`usages.${u}`)}</option>)}</Select></Field>
            <Field id="territory" label={t('territory')}><Select id="territory" name="territory">{TERRITORIES.map((x) => <option key={x} value={x}>{tc(`territories.${x}`)}</option>)}</Select></Field>
            <Field id="term" label={t('term')}><Select id="term" name="term" defaultValue="12">{TERMS.map((n) => <option key={n} value={n}>{tc('term', { n })}</option>)}</Select></Field>
          </div>
          <Field id="genres" label={t('genres')}><Input id="genres" name="genres" /></Field>
          <fieldset className="flex flex-wrap gap-2"><legend className="mb-2 text-sm font-medium text-fg-2">{t('moods')}</legend>
            {MOODS.map((m) => <label key={m} className="flex min-h-10 items-center gap-2 rounded-xl bg-surface-2 px-3 text-sm"><input type="checkbox" name="moods" value={m} className="h-4 w-4 accent-[var(--color-ambar)]" />{tc(`moods.${m}`)}</label>)}
          </fieldset>
          <fieldset className="flex flex-wrap gap-2"><legend className="mb-2 text-sm font-medium text-fg-2">{t('languages')}</legend>
            {['es', 'en', 'pt'].map((l) => <label key={l} className="flex min-h-10 items-center gap-2 rounded-xl bg-surface-2 px-3 text-sm"><input type="checkbox" name="languages" value={l} className="h-4 w-4 accent-[var(--color-ambar)]" />{langs.of(l)}</label>)}
          </fieldset>
          <div className="grid gap-3 md:grid-cols-3">
            <Field id="budgetMin" label={t('budgetMin')}><Input id="budgetMin" name="budgetMin" inputMode="decimal" /></Field>
            <Field id="budgetMax" label={t('budgetMax')}><Input id="budgetMax" name="budgetMax" inputMode="decimal" /></Field>
            <Field id="deadline" label={t('deadline')}><Input id="deadline" name="deadline" type="date" /></Field>
          </div>
        </ActionForm>
      </details>
      {briefs.length === 0 && <p className="text-sm text-fg-2">{t('briefsEmpty')}</p>}
      {briefs.map((b) => (
        <section key={b.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <h2 className="font-display text-xl font-extrabold">{b.title}</h2>
              <span className="text-sm text-fg-2">{tc(`usages.${b.usage}`)} · {tc(`territories.${b.territory}`)}</span>
            </div>
            {b.status === 'open' ? <ActionForm action={closeBriefAction.bind(null, b.id)} submitLabel={t('close')} submitVariant="ghost" className="flex" /> : <StatusPill tone="niebla">{t('closed')}</StatusPill>}
          </div>
          <h3 className="text-xs font-bold tracking-[0.08em] text-fg-2 uppercase">{t('received')} ({b.submissions.length})</h3>
          {b.submissions.length === 0 ? <p className="text-sm text-fg-2">{t('noneReceived')}</p> : (
            <div className="grid gap-4 md:grid-cols-2">
              {b.submissions.map((w) => (
                <CatalogCard key={w.id} item={w} href={`/pluma-sync/obra/${w.id}`} extra={
                  <>
                    {w.note && <p className="text-sm italic text-fg-2">“{w.note}”</p>}
                    <Link href={`/pluma-sync/obra/${w.id}`} className={buttonClass({ variant: 'secondary', size: 'md' })}>{t('license')}</Link>
                  </>
                } />
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  );
}
