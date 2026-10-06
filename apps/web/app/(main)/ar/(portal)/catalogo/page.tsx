import { getLocale, getTranslations } from 'next-intl/server';
import { MOODS } from '@pluma/domain';
import { ScreenTitle, buttonClass } from '@pluma/ui';
import { catalog } from '@pluma/services';
import { CatalogCard } from '@/components/catalog-card';
import { languageNames } from '@/lib/languages';
import { deps, requirePortalRole } from '@/lib/server';

export async function generateMetadata() {
  return { title: (await getTranslations('ar'))('catalogTitle') };
}

/** C2 · Catálogo A&R: búsqueda y filtros, escucha protegida. */
export default async function ArCatalog({ searchParams }: { searchParams: Promise<{ q?: string; genero?: string; idioma?: string; mood?: string }> }) {
  const s = await requirePortalRole('ar_guest', '/ar/catalogo');
  const sp = await searchParams;
  const t = await getTranslations('ar');
  const tc = await getTranslations('catalog');
  const locale = await getLocale();
  const langs = languageNames(locale);
  const items = await catalog.arCatalog(deps(), s.userId, { q: sp.q, genre: sp.genero, language: sp.idioma, mood: MOODS.includes(sp.mood as never) ? sp.mood : undefined });
  const field = 'h-11 rounded-xl border border-field-stroke bg-field px-3 text-[15px] text-fg';
  return (
    <>
      <ScreenTitle title={t('catalogTitle')}>{t('catalogSub')}</ScreenTitle>
      <form role="search" className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('search')}<input name="q" defaultValue={sp.q} className={field} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('genre')}<input name="genero" defaultValue={sp.genero} className={field} /></label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('language')}
          <select name="idioma" defaultValue={sp.idioma ?? ''} className={field}><option value="">{t('any')}</option>{['es', 'en', 'pt'].map((l) => <option key={l} value={l}>{langs.of(l)}</option>)}</select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('mood')}
          <select name="mood" defaultValue={sp.mood ?? ''} className={field}><option value="">{t('any')}</option>{MOODS.map((m) => <option key={m} value={m}>{tc(`moods.${m}`)}</option>)}</select>
        </label>
        <button className={`${buttonClass({ size: 'md' })} self-end`}>{t('filter')}</button>
      </form>
      {items.length === 0 ? <p className="py-8 text-center text-sm text-fg-2">{t('empty')}</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((i) => <CatalogCard key={i.id} item={i} href={`/ar/obra/${i.id}`} />)}
        </div>
      )}
    </>
  );
}
