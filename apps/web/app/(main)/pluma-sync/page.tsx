import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PlumaLogo, buttonClass } from '@pluma/ui';
import { CircleCheck } from 'lucide-react';
import { Waveform } from '@/components/waveform';
import { getAuth, deps } from '@/lib/server';
import { getSession } from '@pluma/services';

export async function generateMetadata() {
  const t = await getTranslations('plumaSync');
  return { title: { absolute: `${t('brand')} · ${t('landingTitle')}` } };
}

/** D1 · Landing de Pluma Sync. */
export default async function SyncLanding() {
  const user = await (await getAuth()).getUser();
  if (user) {
    const s = await getSession(deps(), user.id);
    if (s?.roles.includes('sync_buyer')) redirect('/pluma-sync/buscar');
  }
  const t = await getTranslations('plumaSync');
  const points = t.raw('landingPoints') as string[];
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[1080px] flex-col gap-10 px-5 py-8">
      <header className="flex items-center justify-between">
        <PlumaLogo size={26} product="sync" />
        <Link href="/entrar?next=/pluma-sync/buscar" className="text-sm font-bold">{t('login')}</Link>
      </header>
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <h1 className="font-display text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] md:text-[52px]">{t('landingTitle')}</h1>
          <p className="text-lg leading-relaxed text-fg-2">{t('landingSub')}</p>
          <ul className="flex flex-col gap-2">
            {points.map((p) => <li key={p} className="flex items-center gap-2 text-[15px]"><CircleCheck size={18} strokeWidth={2} className="text-verde" aria-hidden /> {p}</li>)}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Link href="/registro?next=/pluma-sync/alta" className={buttonClass()}>{t('register')}</Link>
            <Link href="/entrar?next=/pluma-sync/buscar" className={buttonClass({ variant: 'secondary' })}>{t('login')}</Link>
          </div>
        </div>
        <div className="flex flex-col gap-3 rounded-[24px] bg-surface p-6">
          <span className="rounded-xl border border-field-stroke bg-field px-4 py-3 text-[15px] text-fg-2">{t('placeholder')}</span>
          <Waveform peaks={[20, 35, 50, 70, 85, 60, 40, 55, 75, 95, 80, 60, 45, 65, 90, 100, 85, 70, 50, 35, 55, 70, 60, 40, 30, 45, 60, 75, 65, 50]} className="h-16 w-full" />
        </div>
      </section>
    </main>
  );
}
