import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { authMode } from '@pluma/db/env';

const LOCALE_COOKIE = 'PLUMA_LOCALE';

/**
 * - Fija el idioma inicial según el navegador si no hay cookie.
 * - Con Supabase Auth, refresca la sesión en cada navegación (los Server Components no pueden escribir cookies).
 */
export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  if (!req.cookies.get(LOCALE_COOKIE)) {
    const al = (req.headers.get('accept-language') ?? '').toLowerCase();
    const first = al.split(',')[0] ?? '';
    const locale = first.startsWith('pt') ? 'pt-BR' : first.startsWith('en') ? 'en' : 'es';
    req.cookies.set(LOCALE_COOKIE, locale);
    res = NextResponse.next({ request: req });
    res.cookies.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
  }

  if (authMode() === 'supabase' && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookies) => {
          for (const c of cookies) req.cookies.set(c.name, c.value);
          const locale = res.cookies.get(LOCALE_COOKIE);
          res = NextResponse.next({ request: req });
          if (locale) res.cookies.set(locale);
          for (const c of cookies) res.cookies.set(c.name, c.value, c.options);
        },
      },
    });
    await supabase.auth.getUser();
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/webhooks|api/health|icon|apple-icon|manifest.webmanifest|sw.js|offline.html|favicon.ico).*)'],
};
