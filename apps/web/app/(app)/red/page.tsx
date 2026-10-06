import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { MODALITIES, REQUEST_TYPES } from '@pluma/domain';
import { ScreenTitle, StatusPill, buttonClass, chipClass } from '@pluma/ui';
import { AudioLines, Plus, Star } from 'lucide-react';
import { network } from '@pluma/services';
import { NetworkTabs } from '@/components/network-tabs';
import { networkGate } from '@/components/network-gate';
import { pct } from '@/lib/format';
import { deps, requireMember } from '@/lib/server';
import { languageNames } from '@/lib/languages';

export async function generateMetadata() {
  return { title: (await getTranslations('network'))('title') };
}

type Search = { tipo?: string; genero?: string; idioma?: string; ciudad?: string; modalidad?: string };

/** A34 · Tablero de solicitudes (no es un feed social). Los perfiles Pro aparecen destacados primero. */
export default async function Board({ searchParams }: { searchParams: Promise<Search> }) {
  const s = await requireMember();
  const sp = await searchParams;
  const t = await getTranslations('network');
  const locale = await getLocale();
  const gate = await networkGate(s.userId);
  const filters = { type: REQUEST_TYPES.includes(sp.tipo as never) ? sp.tipo : undefined, genre: sp.genero, language: sp.idioma, city: sp.ciudad, modality: MODALITIES.includes(sp.modalidad as never) ? sp.modalidad : undefined };
  const items = gate.member ? await network.board(deps(), s.userId, filters) : [];
  const langs = languageNames(locale);
  const href = (p: Partial<Search>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...p }).filter((e): e is [string, string] => !!e[1]));
    return `/red${q.size ? `?${q}` : ''}`;
  };
  const filtered = !!(sp.genero || sp.idioma || sp.ciudad || sp.modalidad || sp.tipo);
  return (
    <>
      <ScreenTitle title={t('title')}>{t('sub')}</ScreenTitle>
      <NetworkTabs current="board" />
      {gate.notice ?? (
        <>
          <Link href="/red/nueva" className={buttonClass({ block: true })}>
            <Plus size={20} strokeWidth={2} aria-hidden /> {t('publish')}
          </Link>
          <nav aria-label={t('type')} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
            <Link href={href({ tipo: undefined })} aria-current={!filters.type ? 'page' : undefined} className={`${chipClass(!filters.type)} no-underline`}>{t('types.all')}</Link>
            {REQUEST_TYPES.map((k) => (
              <Link key={k} href={href({ tipo: k })} aria-current={filters.type === k ? 'page' : undefined} className={`${chipClass(filters.type === k)} no-underline`}>{t(`types.${k}`)}</Link>
            ))}
          </nav>
          <details className="rounded-[20px] bg-surface px-4 py-3" open={!!(sp.genero || sp.idioma || sp.ciudad || sp.modalidad)}>
            <summary className="min-h-8 cursor-pointer text-[15px] font-bold">{t('filters')}</summary>
            <form className="mt-3 grid grid-cols-2 gap-3" role="search">
              {filters.type && <input type="hidden" name="tipo" value={filters.type} />}
              <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">
                {t('genre')}
                <input name="genero" defaultValue={sp.genero} className="h-11 rounded-xl border border-field-stroke bg-field px-3 text-[15px] text-fg" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">
                {t('city')}
                <input name="ciudad" defaultValue={sp.ciudad} className="h-11 rounded-xl border border-field-stroke bg-field px-3 text-[15px] text-fg" />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">
                {t('language')}
                <select name="idioma" defaultValue={sp.idioma ?? ''} className="h-11 rounded-xl border border-field-stroke bg-field px-3 text-[15px] text-fg">
                  <option value="">{t('any')}</option>
                  {['es', 'en', 'pt'].map((l) => <option key={l} value={l}>{langs.of(l)}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-fg-2">
                {t('modality')}
                <select name="modalidad" defaultValue={sp.modalidad ?? ''} className="h-11 rounded-xl border border-field-stroke bg-field px-3 text-[15px] text-fg">
                  <option value="">{t('any')}</option>
                  {MODALITIES.map((m) => <option key={m} value={m}>{t(`modalities.${m}`)}</option>)}
                </select>
              </label>
              <button className={`${buttonClass({ size: 'md' })} col-span-1`}>{t('applyFilters')}</button>
              {filtered && <Link href="/red" className={`${buttonClass({ variant: 'ghost', size: 'md' })} col-span-1`}>{t('clear')}</Link>}
            </form>
          </details>
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-fg-2">{filtered ? t('empty') : t('emptyAll')}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((r) => (
                <li key={r.id}>
                  <Link href={`/red/${r.id}`} className={`flex flex-col gap-2 rounded-[20px] p-4 text-fg no-underline ${r.featured ? 'bg-surface ring-1 ring-ambar/60' : 'bg-surface'}`}>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusPill tone="outline">{t(`types.${r.type}`)}</StatusPill>
                      {r.featured && <StatusPill tone="ambar" icon={<Star size={12} strokeWidth={2.5} aria-hidden />}>{t('featured')}</StatusPill>}
                      {r.mine && <StatusPill tone="niebla">{t('yours')}</StatusPill>}
                      {r.myApplication && <StatusPill tone="verde">{t('youApplied')}</StatusPill>}
                    </span>
                    <span className="font-display text-lg leading-snug font-extrabold">{r.title}</span>
                    <span className="text-sm text-fg-2">{[r.authorName, r.city ?? r.authorCity].filter(Boolean).join(' · ')}</span>
                    <span className="text-xs text-fg-3">
                      {[r.genre, r.bpm ? t('bpm', { bpm: r.bpm }) : null, t(`modalities.${r.modality}`), r.languages.map((l) => langs.of(l)).join(', ')].filter(Boolean).join(' · ')}
                    </span>
                    <span className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-bold text-accent-fg">{t('offered', { pct: pct(r.offeredShareBps, locale) })}</span>
                      <span className="flex items-center gap-2 text-xs text-fg-3">
                        {r.hasDemo && <AudioLines size={16} strokeWidth={2} aria-label={t('hasDemo')} />}
                        {t('applicationsCount', { count: r.applications })}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
