import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { listDemoMail } from '@pluma/adapters';
import { isDemoMode } from '@pluma/db/env';
import { Card, ScreenTitle } from '@pluma/ui';
import { BackLink } from '@/components/back-link';
import { deps } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: (await getTranslations('demo'))('mailTitle'), robots: { index: false } };
}

/** Demo: los correos que en producción saldrían por el proveedor (códigos, invitaciones, statements). */
export default async function DemoMail({ searchParams }: { searchParams: Promise<{ para?: string }> }) {
  if (!isDemoMode()) notFound();
  const { para } = await searchParams;
  const t = await getTranslations('demo');
  const locale = await getLocale();
  const mails = await listDemoMail(deps().db, { recipient: para || undefined, limit: 60 });
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-5 py-6">
      <BackLink href="/inicio" label="Pluma" />
      <ScreenTitle title={t('mailTitle')}>{t('mailIntro')}</ScreenTitle>
      <form className="flex flex-wrap items-end gap-3" role="search">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium text-fg-2">
          {t('filter')}
          <input name="para" type="email" defaultValue={para} className="h-11 rounded-xl border border-[#6B6E8C] bg-surface px-3 text-[15px] text-fg" />
        </label>
        <button className="h-11 rounded-xl bg-ambar px-4 text-sm font-bold text-tinta">{t('search')}</button>
        {para && <Link href="/demo/correo" className="min-h-11 content-center text-sm font-bold">{t('all')}</Link>}
      </form>
      {mails.length === 0 ? (
        <Card><p className="text-sm text-fg-2">{t('empty')}</p></Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {mails.map((m) => (
            <li key={m.id}>
              <details className="rounded-[20px] bg-surface px-4 py-3">
                <summary className="flex cursor-pointer list-none flex-col gap-0.5">
                  <span className="text-[15px] font-bold">{m.subject}</span>
                  <span className="text-xs text-fg-3">{t('to')} {m.recipient} · {fmt.format(new Date(m.created_at))}</span>
                </summary>
                {/* Sin scripts; los enlaces abren en otra pestaña. */}
                <iframe
                  title={m.subject}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  srcDoc={`<base target="_blank">${m.html}`}
                  className="mt-3 h-[560px] w-full rounded-xl bg-white"
                />
              </details>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
