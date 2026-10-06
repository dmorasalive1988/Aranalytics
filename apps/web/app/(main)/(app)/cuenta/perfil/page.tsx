import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { WRITER_ROLES } from '@pluma/domain';
import { Card, Field, Input, ScreenTitle, Select, StatusPill, Textarea } from '@pluma/ui';
import { profiles } from '@pluma/services';
import { ActionForm } from '@/components/action-form';
import { BackLink } from '@/components/back-link';
import { deps, requireMember } from '@/lib/server';
import { addCreditAction, deleteCreditAction, profileAction } from '../../red/actions';
import { languageNames } from '@/lib/languages';

export async function generateMetadata() {
  return { title: (await getTranslations('network'))('editProfile') };
}

/** A42 · Editar mi perfil de la red: bio, rol, idiomas, enlaces a DSPs y créditos para verificar. */
export default async function EditProfile() {
  const s = await requireMember();
  const t = await getTranslations('network');
  const tr = await getTranslations('splits.roles');
  const tc = await getTranslations('common');
  const locale = await getLocale();
  const p = await profiles.myProfile(deps(), s.userId);
  const langs = languageNames(locale);
  return (
    <>
      <BackLink href="/cuenta" label={tc('account')} />
      <ScreenTitle title={t('editProfile')}>{t('editSub')}</ScreenTitle>
      <Link href={`/perfil/${s.userId}`} className="self-start text-sm font-bold">{t('viewPublic')}</Link>
      <ActionForm action={profileAction} submitLabel={t('saveProfile')} pendingLabel={tc('sending')}>
        <Field id="bio" label={t('bio')} hint={t('bioHint')}>
          <Textarea id="bio" name="bio" rows={4} maxLength={600} defaultValue={p.bio} aria-describedby="bio-hint" />
        </Field>
        <Field id="mainRole" label={t('mainRole')}>
          <Select id="mainRole" name="mainRole" defaultValue={p.mainRole ?? ''}>
            <option value="">{t('roleNone')}</option>
            {WRITER_ROLES.map((r) => <option key={r} value={r}>{tr(r)}</option>)}
          </Select>
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-fg-2">{t('writingLanguages')}</legend>
          <div className="flex flex-wrap gap-2">
            {['es', 'en', 'pt'].map((l) => (
              <label key={l} className="flex min-h-11 items-center gap-2 rounded-xl bg-surface px-4 text-[15px]">
                <input type="checkbox" name="languages" value={l} defaultChecked={p.languages.includes(l)} className="h-5 w-5 accent-[var(--color-ambar)]" />
                {langs.of(l)}
              </label>
            ))}
          </div>
        </fieldset>
        {(['spotify', 'apple', 'youtube'] as const).map((k) => (
          <Field key={k} id={k} label={{ spotify: 'Spotify', apple: 'Apple Music', youtube: 'YouTube' }[k]}>
            <Input id={k} name={k} type="url" inputMode="url" placeholder="https://" defaultValue={p.dspLinks[k] ?? ''} />
          </Field>
        ))}
      </ActionForm>

      <section className="flex flex-col gap-3" aria-labelledby="credits">
        <h2 id="credits" className="font-display text-xl font-extrabold">{t('myCredits')}</h2>
        <p className="text-sm text-fg-2">{t('myCreditsSub')}</p>
        {(p.pluma.length > 0 || p.credits.length > 0) && (
          <ul className="flex flex-col">
            {p.pluma.map((c, i) => (
              <li key={`p${i}`} className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2">
                <span className="flex min-w-0 flex-col"><span className="truncate text-[15px]">{c.title}</span><span className="text-xs text-fg-2">{tr.has(c.role) ? tr(c.role) : c.role}</span></span>
                <StatusPill tone="verde">{t('plumaCredit')}</StatusPill>
              </li>
            ))}
            {p.credits.map((c) => (
              <li key={c.id} className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px]">{c.title}{c.artist ? ` — ${c.artist}` : ''}</span>
                  <span className="text-xs text-fg-2">{c.role}{c.rejectedReason ? ` · ${c.rejectedReason}` : ''}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusPill tone={c.verified ? 'verde' : c.reviewedAt ? 'coral' : 'ambar'}>{c.verified ? t('creditVerified') : c.reviewedAt ? t('creditRejected') : t('creditPending')}</StatusPill>
                  <ActionForm action={deleteCreditAction.bind(null, c.id)} submitLabel={t('remove')} submitVariant="ghost" className="flex" />
                </span>
              </li>
            ))}
          </ul>
        )}
        <Card>
          <ActionForm action={addCreditAction} submitLabel={t('addCredit')} submitVariant="secondary" pendingLabel={tc('sending')}>
            <Field id="c-title" label={t('creditTitle')}><Input id="c-title" name="title" required maxLength={200} /></Field>
            <Field id="c-artist" label={t('creditArtist')}><Input id="c-artist" name="artist" maxLength={200} /></Field>
            <Field id="c-role" label={t('creditRole')}><Input id="c-role" name="role" required maxLength={60} /></Field>
            <Field id="c-link" label={t('creditLink')}><Input id="c-link" name="link" type="url" inputMode="url" placeholder="https://" /></Field>
          </ActionForm>
        </Card>
      </section>
    </>
  );
}
