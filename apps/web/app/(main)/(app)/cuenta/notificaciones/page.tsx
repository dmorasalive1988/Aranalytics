import { getTranslations } from 'next-intl/server';
import { Card, Field, Input, ScreenTitle } from '@pluma/ui';
import { MessageCircle } from 'lucide-react';
import { notifications } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { deps, requireMember } from '@/lib/server';
import { PreferenceSwitch, PushDevice } from './prefs-client';
import { whatsappOffAction, whatsappOnAction } from './actions';

export async function generateMetadata() {
  return { title: (await getTranslations('common'))('notifications') };
}

/** A47 · Preferencias por categoría y canal; push en este dispositivo y WhatsApp opcional. */
export default async function NotificationPrefs() {
  const s = await requireMember();
  const t = await getTranslations('prefs');
  const p = await notifications.getPreferences(deps(), s.userId);
  const hasPush = p.push.devices.length > 0;
  const channelHint = (c: 'email' | 'push' | 'whatsapp', locked: boolean) =>
    locked ? t('mandatory') : c === 'push' && !hasPush ? t('pushOff') : c === 'whatsapp' && !p.whatsapp.optedIn ? t('whatsappOff') : undefined;
  return (
    <>
      <BackLink href="/cuenta" label={t('back')} />
      <ScreenTitle title={t('title')}>{t('intro')}</ScreenTitle>

      <PushDevice
        publicKey={p.push.publicKey}
        devices={p.push.devices}
        labels={{ title: t('pushTitle'), body: t('pushBody'), enable: t('pushEnable'), disable: t('pushDisable'), on: t('pushOn'), unsupported: t('pushUnsupported'), denied: t('pushDenied'), unavailable: t('pushUnavailable') }}
      />

      {p.whatsapp.available && (
        <Card className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <MessageCircle size={18} strokeWidth={2} aria-hidden /> WhatsApp
          </h2>
          {p.whatsapp.optedIn ? (
            <ActionForm action={whatsappOffAction} submitLabel={t('whatsappDisable')} submitVariant="secondary">
              <p className="text-sm text-fg-2">{t('whatsappOn', { phone: p.whatsapp.phone! })}</p>
            </ActionForm>
          ) : (
            <ActionForm action={whatsappOnAction} submitLabel={t('whatsappEnable')} submitVariant="secondary">
              <p className="text-sm text-fg-2">{t('whatsappBody')}</p>
              <Field id="phone" label={t('phone')} hint={t('phoneHint')}>
                <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder={t('phonePlaceholder')} hasHint />
              </Field>
              <label className="flex items-start gap-3 text-sm text-fg-2">
                <input type="checkbox" name="consent" className="mt-0.5 h-5 w-5 accent-[var(--color-ambar)]" />
                <span>{t('consent')}</span>
              </label>
            </ActionForm>
          )}
        </Card>
      )}

      {p.categories.map((c) => (
        <Card key={c.category} className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-bold">{t(`cat.${c.category}`)}</h2>
            <p className="text-sm text-fg-3">{t(`catHint.${c.category}`)}</p>
          </div>
          {(['email', 'push', 'whatsapp'] as const)
            .filter((ch) => (ch !== 'whatsapp' || p.whatsapp.available) && (ch !== 'push' || !!p.push.publicKey))
            .map((ch) => {
              const v = c.channels[ch];
              const unavailable = (ch === 'push' && !hasPush) || (ch === 'whatsapp' && !p.whatsapp.optedIn);
              return (
                <PreferenceSwitch
                  key={ch}
                  id={`${c.category}-${ch}`}
                  category={c.category as 'money'}
                  channel={ch}
                  label={t(`ch.${ch}`)}
                  hint={channelHint(ch, v.locked)}
                  checked={v.enabled && !unavailable}
                  disabled={v.locked || unavailable}
                />
              );
            })}
        </Card>
      ))}
      <p className="text-xs text-fg-3">{t('inAppAlways')}</p>
    </>
  );
}
