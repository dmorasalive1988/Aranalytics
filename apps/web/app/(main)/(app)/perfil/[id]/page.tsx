import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Card, ScreenTitle, buttonClass } from '@pluma/ui';
import { ExternalLink } from 'lucide-react';
import { profiles } from '@pluma/services';
import { PersonCard } from '@/components/applicant-card';
import { BackLink } from '@/components/back-link';
import { networkGate } from '@/components/network-gate';
import { deps, requireMember } from '@/lib/server';

export async function generateMetadata() {
  return { title: (await getTranslations('network'))('profileTitle') };
}

const DSP: Record<string, string> = { spotify: 'Spotify', apple: 'Apple Music', youtube: 'YouTube', deezer: 'Deezer', tidal: 'TIDAL', soundcloud: 'SoundCloud' };

/** A41 · Perfil público: créditos verificados, ciudad, idiomas e historial en Pluma. Sin datos de contacto. */
export default async function PublicProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireMember();
  const gate = await networkGate(s.userId);
  if (!gate.member && s.userId !== id) return <>{gate.notice}</>;
  const p = await profiles.publicProfile(deps(), s.userId, id);
  if (!p) notFound();
  const t = await getTranslations('network');
  return (
    <>
      <BackLink href="/red" label={t('title')} />
      <ScreenTitle title={p.name} />
      {s.userId === id && <Link href="/cuenta/perfil" className={buttonClass({ variant: 'secondary', block: true })}>{t('editProfile')}</Link>}
      {p.bio && <p className="text-[15px] leading-relaxed text-fg-2">{p.bio}</p>}
      <PersonCard p={p} />
      {Object.keys(p.dspLinks).length > 0 && (
        <Card className="flex flex-col gap-1">
          <h2 className="text-xs font-bold tracking-[0.08em] text-fg-2 uppercase">{t('links')}</h2>
          {Object.entries(p.dspLinks).map(([k, url]) => (
            <a key={k} href={url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 text-[15px]">
              <ExternalLink size={16} strokeWidth={2} aria-hidden /> {DSP[k] ?? k}
            </a>
          ))}
        </Card>
      )}
      {p.openRequests.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold tracking-[0.08em] text-fg-2 uppercase">{t('openRequests')}</h2>
          <ul className="flex flex-col">
            {p.openRequests.map((r) => (
              <li key={r.id}>
                <Link href={`/red/${r.id}`} className="flex min-h-14 flex-col justify-center border-b border-line py-2 text-fg no-underline">
                  <span className="text-[15px] font-medium">{r.title}</span>
                  <span className="text-xs text-fg-2">{t(`types.${r.type}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
