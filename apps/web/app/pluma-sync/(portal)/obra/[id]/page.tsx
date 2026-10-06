import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { LICENSE_USAGES, TERMS, TERRITORIES } from '@pluma/domain';
import { Card, Field, Select, Textarea } from '@pluma/ui';
import { catalog } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { CatalogCard } from '@/components/catalog-card';
import { QuoteForm } from '@/components/quote-form';
import { deps, requirePortalRole } from '@/lib/server';
import { licenseAction, quoteAction } from '../../../actions';

/** D4 ficha · D5 cotizador · D6 solicitud de licencia. */
export default async function SyncWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requirePortalRole('sync_buyer', `/pluma-sync/obra/${id}`);
  const w = await catalog.syncWork(deps(), s.userId, id);
  if (!w) notFound();
  const t = await getTranslations('plumaSync');
  const tc = await getTranslations('catalog');
  const tcom = await getTranslations('common');
  const locale = await getLocale();
  const briefs = (await catalog.buyerBriefs(deps(), s.userId)).filter((b) => b.status === 'open');
  const usages = LICENSE_USAGES.map((u) => [u, tc(`usages.${u}`)] as [string, string]);
  const territories = TERRITORIES.map((x) => [x, tc(`territories.${x}`)] as [string, string]);
  const terms = TERMS.map((n) => [n, tc('term', { n })] as [number, string]);
  const field = 'h-11 rounded-xl border border-field-stroke bg-field px-3 text-[15px] text-fg';
  return (
    <>
      <BackLink href="/pluma-sync/buscar" label={t('search')} />
      <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
        <div className="flex flex-col gap-4">
          <CatalogCard item={w} href={`/pluma-sync/obra/${id}`} extra={w.oneStop ? <p className="text-sm text-accent-fg">{t('oneStopNote')}</p> : undefined} />
          <Card className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-extrabold">{t('requestTitle')}</h2>
            <ActionForm action={licenseAction.bind(null, id)} submitLabel={t('send')} pendingLabel={tcom('sending')}>
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('usage')}<select name="usage" className={field}>{usages.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('territory')}<select name="territory" className={field}>{territories.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('term')}<select name="term" defaultValue="12" className={field}>{terms.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              </div>
              {w.oneStop && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name="oneStop" className="h-5 w-5 accent-[var(--color-ambar)]" />{t('includeMaster')}</label>}
              <Field id="project" label={t('project')} hint={t('projectHint')}>
                <Textarea id="project" name="project" rows={4} maxLength={2000} required aria-describedby="project-hint" />
              </Field>
              {briefs.length > 0 && (
                <Field id="brief" label={t('brief')}>
                  <Select id="brief" name="brief" defaultValue=""><option value="">{t('none')}</option>{briefs.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</Select>
                </Field>
              )}
            </ActionForm>
          </Card>
        </div>
        <Card className="flex h-fit flex-col gap-3">
          <h2 className="font-display text-lg font-extrabold">{t('quoteTitle')}</h2>
          <QuoteForm action={quoteAction} locale={locale} options={{ usages, territories, terms }} oneStopAvailable={w.oneStop}
            labels={{ usage: t('usage'), territory: t('territory'), term: t('term'), includeMaster: t('includeMaster'), quoteCta: t('quoteCta'), range: t('range'), referential: t('referential') }} />
        </Card>
      </div>
    </>
  );
}
