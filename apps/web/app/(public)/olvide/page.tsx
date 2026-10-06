import { getTranslations } from 'next-intl/server';
import { Field, Input, ScreenTitle } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { forgotAction } from '../actions';

export async function generateMetadata() {
  return { title: (await getTranslations('auth'))('forgotTitle') };
}

/** Olvidé mi contraseña: pide el correo y envía un código. */
export default async function Forgot() {
  const t = await getTranslations('auth');
  const tc = await getTranslations('common');
  return (
    <div className="flex flex-col gap-7">
      <BackLink href="/entrar" label={tc('back')} />
      <ScreenTitle title={t('forgotTitle')}>{t('forgotSub')}</ScreenTitle>
      <ActionForm action={forgotAction} submitLabel={t('sendCode')} pendingLabel={tc('sending')}>
        <Field id="email" label={t('email')}>
          <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
        </Field>
      </ActionForm>
    </div>
  );
}
