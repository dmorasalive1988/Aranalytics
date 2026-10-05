import { NextResponse, type NextRequest } from 'next/server';
import { ensureAppUser, getSession } from '@pluma/services';
import { currentLocale, deps, getAuth, STEP_PATH } from '@/lib/server';

/** Retorno de Google / Apple (Supabase Auth). */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.redirect(new URL('/entrar', req.url));
  try {
    const user = await (await getAuth()).exchangeOAuthCode(code);
    await ensureAppUser(deps(), user, await currentLocale());
    const s = await getSession(deps(), user.id);
    return NextResponse.redirect(new URL(s ? STEP_PATH[s.step] : STEP_PATH.profile, req.url));
  } catch {
    return NextResponse.redirect(new URL('/entrar', req.url));
  }
}
