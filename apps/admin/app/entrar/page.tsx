import { Field, Input, Notice, PlumaLogo } from '@pluma/ui';
import { isDemoMode } from '@pluma/db/env';
import { ActionForm } from '@/components/action-form';
import { signInAction } from './actions';

export const metadata = { title: 'Entrar' };

/** Acceso del personal interno. En producción exige segundo factor (TOTP de Supabase). */
export default async function SignIn({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center gap-6 px-5">
      <PlumaLogo size={28} product="admin" />
      <h1 className="font-display text-3xl font-extrabold">Back-office</h1>
      {isDemoMode() && <Notice tone="info" title="Demo: cuentas de ejemplo">operaciones@pluma.test (operador) · aprobaciones@pluma.test (aprobador) · admin@pluma.test (super admin). Contraseña: pluma-dev-2026</Notice>}
      {e === 'mfa' && <Notice tone="alert" title="Activa tu segundo factor (TOTP) para entrar." />}
      {e === 'forbidden' && <Notice tone="alert" title="Esta cuenta no tiene acceso al back-office." />}
      <div className="rounded-2xl bg-surface p-6">
        <ActionForm action={signInAction} submitLabel="Entrar" pendingLabel="Entrando…">
          <Field id="email" label="Correo"><Input id="email" name="email" type="email" autoComplete="username" required /></Field>
          <Field id="password" label="Contraseña"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
        </ActionForm>
      </div>
    </main>
  );
}
