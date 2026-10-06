import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card, Notice, PlumaLogo, ScreenTitle, buttonClass } from '@pluma/ui';
import { CircleAlert } from 'lucide-react';
import { catalog } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { deps, getAuth } from '@/lib/server';
import { acceptInvitationAction } from '../../actions';

export async function generateMetadata() {
  return { title: (await getTranslations('ar'))('invTitle'), robots: { index: false } };
}

/** C1 · Aceptar la invitación al catálogo A&R (solo por invitación). */
export default async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations('ar');
  const info = await catalog.invitationInfo(deps(), token);
  const user = await (await getAuth()).getUser();
  const here = `/ar/invitacion/${token}`;
  const invalid = !info || info.expired || info.revoked || (info.accepted && user?.email.toLowerCase() !== info.email.toLowerCase());
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-6 px-5 py-10">
      <PlumaLogo size={26} product="ar" />
      <ScreenTitle title={t('invTitle')}>{info ? t('invSub', { company: info.company, email: info.email }) : null}</ScreenTitle>
      {invalid ? (
        <Notice tone="alert" icon={<CircleAlert size={20} strokeWidth={2} />} title={t('expired')} />
      ) : (
        <Card className="flex flex-col gap-4">
          <p className="text-[15px] leading-relaxed">{t('invBody')}</p>
          {user && user.email.toLowerCase() !== info!.email.toLowerCase() && <Notice tone="alert" title={t('otherEmail', { email: info!.email })} />}
          {user && user.email.toLowerCase() === info!.email.toLowerCase() ? (
            <ActionForm action={acceptInvitationAction.bind(null, token)} submitLabel={t('accept')} />
          ) : (
            <div className="flex flex-col gap-3">
              <Link href={`/registro?next=${encodeURIComponent(here)}&email=${encodeURIComponent(info!.email)}`} className={buttonClass({ block: true })}>{t('create')}</Link>
              <Link href={`/entrar?next=${encodeURIComponent(here)}&email=${encodeURIComponent(info!.email)}`} className={buttonClass({ variant: 'secondary', block: true })}>{t('haveAccount')}</Link>
            </div>
          )}
        </Card>
      )}
    </main>
  );
}
