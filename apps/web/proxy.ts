import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { authMode } from '@pluma/db/env';
import { PLAN_COOKIE } from './lib/plan-cookie';

const LOCALE_COOKIE = 'PLUMA_LOCALE';

/** Rutas compartidas por todas las superficies (cuenta, demo, archivos de la app). */
const SHARED = /^\/(entrar|registro|verificar|olvide|restablecer|demo|api|auth|_next|icon|apple-icon|manifest|sw\.js|offline\.html)/;

/**
 * Subdominios: sync.<dominio> sirve Pluma Sync y ar.<dominio> el portal A&R (mismo despliegue).
 * Sin subdominio, las rutas /pluma-sync y /ar funcionan igual.
 */
function surfaceRewrite(req: NextRequest) {
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').toLowerCase();
  const prefix = host.startsWith('sync.') ? '/pluma-sync' : host.startsWith('ar.') ? '/ar' : null;
  const path = req.nextUrl.pathname;
  if (!prefix || path.startsWith(prefix) || SHARED.test(path)) return null;
  const url = req.nextUrl.clone();
  url.pathname = path === '/' ? prefix : `${prefix}${path}`;
  return url;
}

/** Idioma del sitio público en la URL (/es, /en, /pt) → idioma de la app. */
const SITE_PATH = /^\/(es|en|pt)(\/|$)/;
const SITE_TO_LOCALE: Record<string, string> = { es: 'es', en: 'en', pt: 'pt-BR', 'pt-BR': 'pt-BR' };
const YEAR = 60 * 60 * 24 * 365;

/**
 * Cookies que esta petición debe fijar:
 * - idioma: el de la página del sitio que se visita, el de ?lang= (enlaces "Hazte socio") o, en la primera visita, el del navegador;
 * - plan: ?plan=socio|pro de "Elegir Socio / Pro", para dejarlo preseleccionado en el onboarding.
 */
function cookiesToSet(req: NextRequest) {
  const out: { name: string; value: string; maxAge: number }[] = [];
  const current = req.cookies.get(LOCALE_COOKIE)?.value;
  const fromPath = SITE_PATH.exec(req.nextUrl.pathname)?.[1];
  const fromQuery = req.nextUrl.searchParams.get('lang') ?? '';
  const chosen = SITE_TO_LOCALE[fromPath ?? ''] ?? SITE_TO_LOCALE[fromQuery];
  if (chosen && chosen !== current) out.push({ name: LOCALE_COOKIE, value: chosen, maxAge: YEAR });
  else if (!chosen && !current) {
    const first = (req.headers.get('accept-language') ?? '').toLowerCase().split(',')[0] ?? '';
    out.push({ name: LOCALE_COOKIE, value: first.startsWith('pt') ? 'pt-BR' : first.startsWith('en') ? 'en' : 'es', maxAge: YEAR });
  }
  const plan = req.nextUrl.searchParams.get('plan');
  if (plan === 'socio' || plan === 'pro') out.push({ name: PLAN_COOKIE, value: plan, maxAge: 60 * 60 * 24 * 30 });
  return out;
}

/** Con Supabase Auth, refresca la sesión en cada navegación de la app (los Server Components no pueden escribir cookies). */
export async function proxy(req: NextRequest) {
  const rewrite = surfaceRewrite(req);
  const pending = cookiesToSet(req);
  for (const c of pending) req.cookies.set(c.name, c.value);
  const next = () => (rewrite ? NextResponse.rewrite(rewrite, { request: req }) : NextResponse.next({ request: req }));
  const withCookies = (res: NextResponse) => {
    for (const c of pending) res.cookies.set(c.name, c.value, { path: '/', maxAge: c.maxAge, sameSite: 'lax' });
    return res;
  };
  let res = withCookies(next());

  // El sitio público es estático y no usa sesión: no se consulta a Supabase en cada visita.
  if (SITE_PATH.test(req.nextUrl.pathname)) return res;

  if (authMode() === 'supabase' && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          for (const c of cookies) req.cookies.set(c.name, c.value);
          res = withCookies(next());
          for (const c of cookies) res.cookies.set(c.name, c.value, c.options);
        },
      },
    });
    await supabase.auth.getUser();
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/webhooks|api/health|icon|apple-icon|manifest.webmanifest|sw.js|offline.html|favicon.ico|robots.txt|sitemap.xml|_vercel).*)'],
};
