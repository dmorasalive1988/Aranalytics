import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DevAuth, SupabaseAuth, type AuthProvider, type CookieStore } from '@pluma/adapters';
import { admin, depsFromEnv, type Deps, type RequestCtx } from '@pluma/services';

export const deps = (): Deps => depsFromEnv();
const authMode = () => (process.env.PLUMA_AUTH_MODE ?? (process.env.NODE_ENV === 'production' ? 'supabase' : 'dev')) as 'dev' | 'supabase';

export async function getAuth(): Promise<AuthProvider> {
  const jar = await cookies();
  const store: CookieStore = {
    getAll: () => jar.getAll().map((c) => ({ name: c.name, value: c.value })),
    setAll: (list) => {
      try {
        for (const c of list) jar.set(c.name, c.value, { secure: process.env.NODE_ENV === 'production', ...(c.options ?? {}) });
      } catch {
        /* Server Component */
      }
    },
  };
  if (authMode() === 'supabase') return new SupabaseAuth(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, store);
  const d = deps();
  return new DevAuth(d.db, store, d.signingSecret, d.mail);
}

export async function requestCtx(): Promise<RequestCtx> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
  return { ip: ip && /^[0-9a-f.:]+$/i.test(ip) ? ip : null, userAgent: h.get('user-agent') };
}

export interface Staff {
  id: string;
  email: string;
  roles: admin.StaffRole[];
}

/** Personal interno con rol y, en producción, segundo factor (aal2). */
export async function requireStaff(): Promise<Staff> {
  const user = await (await getAuth()).getUser();
  if (!user) redirect('/entrar');
  const roles = await admin.staffRoles(deps(), user.id);
  if (!roles.length) redirect('/entrar?e=forbidden');
  if (authMode() === 'supabase' && user.aal !== 'aal2') redirect('/entrar?e=mfa');
  return { id: user.id, email: user.email, roles };
}
