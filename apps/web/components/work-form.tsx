import { getTranslations } from 'next-intl/server';
import { Field, Input, Select, Textarea } from '@pluma/ui';
import { ActionForm, type ActionState } from './action-form';

export interface WorkDefaults {
  title?: string;
  altTitles?: string[];
  language?: string;
  genre?: string;
  lyrics?: string | null;
  aiDeclaration?: string;
  isrcs?: string[];
}

/** A22 · Datos de la obra (crear y editar borrador). */
export async function WorkForm({ action, defaults = {}, submitLabel }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; defaults?: WorkDefaults; submitLabel: string }) {
  const t = await getTranslations('workForm');
  const tc = await getTranslations('common');
  return (
    <ActionForm action={action} submitLabel={submitLabel} pendingLabel={tc('sending')}>
      <Field id="title" label={t('title')}>
        <Input id="title" name="title" defaultValue={defaults.title} required maxLength={200} />
      </Field>
      <Field id="altTitles" label={t('altTitles')} hint={t('altTitlesHint')} optional={tc('optional')}>
        <Input id="altTitles" name="altTitles" defaultValue={defaults.altTitles?.join(', ')} hasHint />
      </Field>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field id="language" label={t('language')}>
          <Select id="language" name="language" defaultValue={defaults.language ?? 'es'}>
            {(['es', 'en', 'pt'] as const).map((l) => <option key={l} value={l}>{t(`languages.${l}`)}</option>)}
          </Select>
        </Field>
        <Field id="genre" label={t('genre')}>
          <Input id="genre" name="genre" defaultValue={defaults.genre} placeholder={t('genrePlaceholder')} required />
        </Field>
      </div>
      <Field id="lyrics" label={t('lyrics')} hint={t('lyricsHint')} optional={tc('optional')}>
        <Textarea id="lyrics" name="lyrics" defaultValue={defaults.lyrics ?? ''} rows={6} />
      </Field>
      <Field id="isrcs" label={t('isrcs')} hint={t('isrcsHint')} optional={tc('optional')}>
        <Input id="isrcs" name="isrcs" defaultValue={defaults.isrcs?.join(', ')} autoCapitalize="characters" hasHint />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-[13px] font-medium text-fg-3">{t('ai')}</legend>
        {(['none', 'ai_assisted', 'ai_generated'] as const).map((v) => (
          <label key={v} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-stroke px-4 py-2.5 text-[15px] has-[:checked]:border-ambar">
            <input type="radio" name="ai" value={v} defaultChecked={defaults.aiDeclaration === v} required className="h-5 w-5 accent-[#F2A541]" />
            {t(`aiOptions.${v}`)}
          </label>
        ))}
        <p className="text-xs text-fg-2">{t('aiHint')}</p>
      </fieldset>
    </ActionForm>
  );
}
