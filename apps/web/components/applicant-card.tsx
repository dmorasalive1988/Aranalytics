import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Card, StatusPill } from '@pluma/ui';
import { BadgeCheck, ExternalLink, Star } from 'lucide-react';
import type { profiles } from '@pluma/services';
import { date } from '@/lib/format';
import { languageNames } from '@/lib/languages';

type CardData = Awaited<ReturnType<typeof profiles.publicCard>>;

/** Tarjeta pública de una persona: nombre artístico, rol, ciudad, idiomas, créditos verificados e historial. Nunca contactos. */
export async function PersonCard({ p, children, compact }: { p: CardData; children?: React.ReactNode; compact?: boolean }) {
  const t = await getTranslations('network');
  const tr = await getTranslations('splits.roles');
  const locale = await getLocale();
  const langs = languageNames(locale);
  const regions = new Intl.DisplayNames([locale], { type: 'region' });
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={`/perfil/${p.userId}`} className="font-display text-lg font-extrabold text-fg no-underline">{p.name}</Link>
          <span className="text-sm text-fg-2">{[p.mainRole ? tr(p.mainRole) : null, [p.city, p.country ? regions.of(p.country) : null].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</span>
          {p.languages.length > 0 && <span className="text-xs text-fg-3">{p.languages.map((l) => langs.of(l)).join(', ')}</span>}
        </div>
        {p.featured && <StatusPill tone="ambar" icon={<Star size={12} strokeWidth={2.5} aria-hidden />}>{t('featured')}</StatusPill>}
      </div>
      {!compact && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold tracking-[0.08em] text-fg-2 uppercase">{t('credits')}</span>
          {p.credits.length === 0 ? (
            <span className="text-sm text-fg-3">{t('noCredits')}</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {p.credits.map((c, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <BadgeCheck size={16} strokeWidth={2} className="shrink-0 text-verde" aria-label={c.source === 'pluma_registry' ? t('plumaCredit') : t('creditVerified')} />
                  <span className="min-w-0 truncate">
                    {c.title}
                    {c.artist ? ` — ${c.artist}` : ''} <span className="text-fg-3">· {tr.has(c.role) ? tr(c.role) : c.role}</span>
                  </span>
                  {c.dspUrl && (
                    <a href={c.dspUrl} target="_blank" rel="noopener noreferrer" aria-label={`${c.title} (DSP)`} className="shrink-0 text-fg-2">
                      <ExternalLink size={14} strokeWidth={2} aria-hidden />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          <span className="text-xs text-fg-3">
            {t('history', { date: p.history.memberSince ? date(p.history.memberSince, locale) : '—', works: p.history.registeredWorks, collabs: p.history.collaborations })}
          </span>
        </div>
      )}
      {children}
    </Card>
  );
}
