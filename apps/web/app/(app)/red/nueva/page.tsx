import { getLocale, getTranslations } from 'next-intl/server';
import { MODALITIES, REQUEST_TYPES } from '@pluma/domain';
import { Field, Input, ScreenTitle, Select, Textarea } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { networkGate } from '@/components/network-gate';
import { requireMember } from '@/lib/server';
import { publishAction } from '../actions';
import { languageNames } from '@/lib/languages';

export async function generateMetadata() {
  return { title: (await getTranslations('network'))('formTitle') };
}

const fileClass = 'block w-full rounded-xl border border-field-stroke bg-field px-4 py-3 text-sm text-fg file:mr-4 file:rounded-lg file:border-0 file:bg-ambar file:px-3 file:py-2 file:font-bold file:text-tinta';

/** A36 · Publicar solicitud: tipo, descripción, género, BPM, split ofrecido y demo con marca de agua. */
export default async function NewRequest() {
  const s = await requireMember();
  const t = await getTranslations('network');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const gate = await networkGate(s.userId);
  const langs = languageNames(locale);
  const mainLang = locale.slice(0, 2);
  return (
    <>
      <BackLink href="/red" label={t('title')} />
      <ScreenTitle title={t('formTitle')}>{t('formSub')}</ScreenTitle>
      {gate.notice ?? (
        <ActionForm action={publishAction} submitLabel={t('publishCta')} pendingLabel={tc('sending')}>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-fg-2">{t('type')}</legend>
            {REQUEST_TYPES.map((k, i) => (
              <label key={k} className="flex min-h-12 items-center gap-3 rounded-xl bg-surface px-4 text-[15px]">
                <input type="radio" name="type" value={k} defaultChecked={i === 0} className="h-5 w-5 accent-[var(--color-ambar)]" />
                {t(`types.${k}`)}
              </label>
            ))}
          </fieldset>
          <Field id="title" label={t('titleLabel')}>
            <Input id="title" name="title" required maxLength={120} />
          </Field>
          <Field id="description" label={t('description')}>
            <Textarea id="description" name="description" required rows={5} maxLength={2000} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="genre" label={t('genre')}>
              <Input id="genre" name="genre" required />
            </Field>
            <Field id="bpm" label="BPM" hint={t('bpmHint')}>
              <Input id="bpm" name="bpm" inputMode="numeric" pattern="[0-9]*" hasHint />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-fg-2">{t('languages')}</legend>
            <div className="flex flex-wrap gap-2">
              {['es', 'en', 'pt'].map((l) => (
                <label key={l} className="flex min-h-11 items-center gap-2 rounded-xl bg-surface px-4 text-[15px]">
                  <input type="checkbox" name="languages" value={l} defaultChecked={l === mainLang} className="h-5 w-5 accent-[var(--color-ambar)]" />
                  {langs.of(l)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Field id="modality" label={t('modality')}>
              <Select id="modality" name="modality" defaultValue="remote">
                {MODALITIES.map((m) => <option key={m} value={m}>{t(`modalities.${m}`)}</option>)}
              </Select>
            </Field>
            <Field id="city" label={t('city')} hint={t('cityHint')}>
              <Input id="city" name="city" hasHint />
            </Field>
          </div>
          <Field id="offered" label={t('offeredLabel')} hint={t('offeredHint')}>
            <Input id="offered" name="offered" inputMode="decimal" defaultValue="40" required hasHint />
          </Field>
          <Field id="demo" label={t('demoLabel')} hint={t('demoHint')}>
            <input id="demo" name="demo" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/flac" aria-describedby="demo-hint" className={fileClass} />
          </Field>
        </ActionForm>
      )}
    </>
  );
}
