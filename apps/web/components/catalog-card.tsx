import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { StatusPill } from '@pluma/ui';
import type { catalog } from '@pluma/services';
import { ProtectedAudio } from '@/components/protected-audio';
import { Waveform } from '@/components/waveform';
import { date } from '@/lib/format';
import { languageNames } from '@/lib/languages';

type Item = Awaited<ReturnType<typeof catalog.arCatalog>>[number];

/** Tarjeta de obra en los catálogos (A&R y Sync): etiquetas, forma de onda y escucha protegida. */
export async function CatalogCard({ item, href, extra }: { item: Item; href: string; extra?: React.ReactNode }) {
  const t = await getTranslations('catalog');
  const ta = await getTranslations('ar');
  const locale = await getLocale();
  const langs = languageNames(locale);
  return (
    <article className="flex flex-col gap-3 rounded-[20px] bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={href} className="font-display text-lg leading-snug font-extrabold text-fg no-underline">{item.title}</Link>
          <span className="text-sm text-fg-2">{[item.artistName ? ta('by', { artist: item.artistName }) : null, item.genre, langs.of(item.language), item.bpm ? t('bpm', { bpm: item.bpm }) : null, item.musicalKey].filter(Boolean).join(' · ')}</span>
        </div>
        {item.heldUntil && <StatusPill tone="coral">{ta('heldUntil', { date: date(item.heldUntil, locale) })}</StatusPill>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {item.moods.map((m) => <StatusPill key={m} tone="niebla">{t.has(`moods.${m}`) ? t(`moods.${m}`) : m}</StatusPill>)}
        {item.vocals && <StatusPill tone="outline">{t(`vocals.${item.vocals}`)}</StatusPill>}
        {item.instrumentalAvailable && <StatusPill tone="outline">{t('instrumental')}</StatusPill>}
        {item.oneStop && <StatusPill tone="ambar">{t('oneStop')}</StatusPill>}
      </div>
      {item.description && <p className="text-sm leading-relaxed text-fg-2">{item.description}</p>}
      {item.previewFileId && (
        <div className="flex flex-col gap-1">
          <Waveform peaks={item.waveform} />
          <ProtectedAudio fileId={item.previewFileId} label={item.title} />
        </div>
      )}
      {extra}
    </article>
  );
}
