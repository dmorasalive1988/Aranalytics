import { getLocale, getTranslations } from 'next-intl/server';
import { MOODS, VOCALS, type Mood, type Vocals } from '@pluma/domain';
import { StatusPill, buttonClass } from '@pluma/ui';
import { Sparkles } from 'lucide-react';
import { catalog } from '@pluma/services';
import { CatalogCard } from '@/components/catalog-card';
import { languageNames } from '@/lib/languages';
import { deps, requirePortalRole } from '@/lib/server';

export async function generateMetadata() {
  return { title: (await getTranslations('plumaSync'))('search') };
}

type Search = { q?: string; mood?: string; genero?: string; idioma?: string; voz?: string; instrumental?: string; onestop?: string; bpmMin?: string; bpmMax?: string };
const num = (v?: string) => (v && /^\d{2,3}$/.test(v) ? Number(v) : null);

/** D2/D3 · Búsqueda en lenguaje natural + filtros; resultados con forma de onda, etiquetas y escucha. */
export default async function SyncSearch({ searchParams }: { searchParams: Promise<Search> }) {
  const s = await requirePortalRole('sync_buyer', '/pluma-sync/buscar');
  const sp = await searchParams;
  const t = await getTranslations('plumaSync');
  const tc = await getTranslations('catalog');
  const locale = await getLocale();
  const langs = languageNames(locale);
  const ui = {
    moods: MOODS.includes(sp.mood as Mood) ? [sp.mood as Mood] : [],
    genres: sp.genero ? [sp.genero] : [],
    languages: sp.idioma ? [sp.idioma] : [],
    vocals: VOCALS.includes(sp.voz as Vocals) ? (sp.voz as Vocals) : undefined,
    instrumental: sp.instrumental === '1' ? true : undefined,
    oneStop: sp.onestop === '1' ? true : undefined,
    bpmMin: num(sp.bpmMin) ?? undefined,
    bpmMax: num(sp.bpmMax) ?? undefined,
  };
  const r = await catalog.searchSync(deps(), s.userId, sp.q ?? '', ui);
  const f = r.filters;
  const chips = [
    ...f.genres,
    ...f.moods.map((m) => tc(`moods.${m}`)),
    ...f.languages.map((l) => langs.of(l)),
    f.vocals ? tc(`vocals.${f.vocals}`) : null,
    f.instrumental ? tc('instrumental') : null,
    f.oneStop ? tc('oneStop') : null,
    f.bpmMin !== null || f.bpmMax !== null ? `${f.bpmMin ?? '…'}–${f.bpmMax ?? '…'} BPM` : null,
    f.text ? `“${f.text}”` : null,
  ].filter(Boolean) as string[];
  const field = 'h-11 rounded-xl border border-field-stroke bg-field px-3 text-[15px] text-fg';
  return (
    <>
      <form role="search" className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="q">{t('search')}</label>
          <input id="q" name="q" defaultValue={sp.q} placeholder={t('placeholder')} className="h-14 flex-1 rounded-2xl border border-field-stroke bg-field px-4 text-base text-fg" />
          <button className={buttonClass()}>{t('searchCta')}</button>
        </div>
        <details className="rounded-[20px] bg-surface px-4 py-3" open={!!(sp.mood || sp.genero || sp.idioma || sp.voz || sp.instrumental || sp.onestop || sp.bpmMin || sp.bpmMax)}>
          <summary className="min-h-8 cursor-pointer text-[15px] font-bold">{t('apply')}</summary>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('moods')}
              <select name="mood" defaultValue={sp.mood ?? ''} className={field}><option value="">{t('any')}</option>{MOODS.map((m) => <option key={m} value={m}>{tc(`moods.${m}`)}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('genre')}<input name="genero" defaultValue={sp.genero} className={field} /></label>
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('language')}
              <select name="idioma" defaultValue={sp.idioma ?? ''} className={field}><option value="">{t('any')}</option>{['es', 'en', 'pt'].map((l) => <option key={l} value={l}>{langs.of(l)}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('vocals')}
              <select name="voz" defaultValue={sp.voz ?? ''} className={field}><option value="">{t('any')}</option>{VOCALS.map((v) => <option key={v} value={v}>{tc(`vocals.${v}`)}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('bpmMin')}<input name="bpmMin" inputMode="numeric" defaultValue={sp.bpmMin} className={field} /></label>
            <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">{t('bpmMax')}<input name="bpmMax" inputMode="numeric" defaultValue={sp.bpmMax} className={field} /></label>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" name="instrumental" value="1" defaultChecked={sp.instrumental === '1'} className="h-5 w-5 accent-[var(--color-ambar)]" />{t('instrumentalOnly')}</label>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm"><input type="checkbox" name="onestop" value="1" defaultChecked={sp.onestop === '1'} className="h-5 w-5 accent-[var(--color-ambar)]" />{t('oneStopOnly')}</label>
          </div>
        </details>
      </form>
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1 font-bold text-fg-2"><Sparkles size={16} strokeWidth={2} aria-hidden /> {t('understood')}:</span>
          {chips.map((c) => <StatusPill key={c} tone="niebla">{c}</StatusPill>)}
          <span className="text-xs text-fg-3">({r.parser === 'claude' ? t('parserClaude') : t('parserRules')})</span>
        </div>
      )}
      <p className="text-sm font-bold text-fg-2">{t('results', { count: r.items.length })}</p>
      {r.items.length === 0 ? <p className="py-8 text-center text-sm text-fg-2">{t('empty')}</p> : (
        <div className="grid gap-4 md:grid-cols-2">
          {r.items.map((i) => <CatalogCard key={i.id} item={i} href={`/pluma-sync/obra/${i.id}`} />)}
        </div>
      )}
    </>
  );
}
