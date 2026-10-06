import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DevAuth, SupabaseAuth, type AuthProvider, type CookieStore } from '@pluma/adapters';
import { authMode as sharedAuthMode, devAccountsTable, inlineDispatch } from '@pluma/db/env';
import { isLocale, LOCALE_COOKIE, type Locale } from '@pluma/i18n';
import { depsFromEnv, ensureAppUser, getSession, type Deps, type OnboardingStep, type RequestCtx, type SessionInfo } from '@pluma/services';

export const deps = (): Deps => depsFromEnv();

export const authMode = sharedAuthMode;

async function cookieStore(): Promise<CookieStore> {
  const jar = await cookies();
  return {
    getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })),
    setAll: (list) => {
      try {
        for (const c of list) jar.set(c.name, c.value, { secure: process.env.NODE_ENV === 'production', ...(c.options ?? {}) });
      } catch {
        // En Server Components no se pueden escribir cookies; el proxy refresca la sesión.
      }
    },
  };
}

export async function getAuth(): Promise<AuthProvider> {
  const store = await cookieStore();
  if (authMode() === 'supabase') return new SupabaseAuth(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, store);
  const d = deps();
  return new DevAuth(d.db, store, d.signingSecret, d.mail, devAccountsTable());
}

export async function requestCtx(): Promise<RequestCtx> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  return { ip: ip && /^[0-9a-f.:]+$/i.test(ip) ? ip : null, userAgent: h.get('user-agent') };
}

export async function currentLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : 'es';
}

export async function setLocaleCookie(locale: Locale) {
  (await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
}

export const STEP_PATH: Record<OnboardingStep, string> = {
  profile: '/onboarding/perfil',
  society: '/onboarding/sociedad',
  guardian: '/onboarding/tutor',
  plan: '/onboarding/plan',
  contract: '/onboarding/contrato',
  payment: '/onboarding/pago',
  done: '/inicio',
};

/** Usuario autenticado y verificado (puede estar en onboarding). */
export async function requireUser(): Promise<SessionInfo> {
  const auth = await getAuth();
  const user = await auth.getUser();
  if (!user) redirect('/entrar');
  if (!user.emailVerified) redirect(`/verificar?email=${encodeURIComponent(user.email)}`);
  let session = await getSession(deps(), user.id);
  if (!session) {
    await ensureAppUser(deps(), user, await currentLocale());
    session = (await getSession(deps(), user.id))!;
  }
  return session;
}

/** Autor con onboarding completo y plan pagado: la app solo existe para socios. */
export async function requireMember(): Promise<SessionInfo> {
  const s = await requireUser();
  if (s.step !== 'done') redirect(STEP_PATH[s.step]);
  return s;
}

/** Onboarding: si ya pasó este paso, lo lleva al que le toca. */
export async function requireStep(...allowed: OnboardingStep[]): Promise<SessionInfo> {
  const s = await requireUser();
  if (!allowed.includes(s.step)) redirect(STEP_PATH[s.step]);
  return s;
}

/**
 * En desarrollo (sin worker corriendo) despacha el outbox de eventos justo después de responder.
 * En producción lo hace el worker.
 */
export async function kickDispatch() {
  if (!inlineDispatch()) return;
  const { after } = await import('next/server');
  const { dispatchPending } = await import('@pluma/services');
  after(() => dispatchPending(deps()).catch((e) => console.error('[eventos]', e)));
}
