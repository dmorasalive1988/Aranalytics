import { createHmac, randomInt, scrypt as scryptCb, timingSafeEqual, randomBytes, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { createServerClient } from '@supabase/ssr';
import type { Db } from '@pluma/db';
import { sql } from '@pluma/db';
import type { EmailSender } from './email';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  /** Nivel de autenticación: aal2 = con segundo factor (requerido en el back-office). */
  aal: 'aal1' | 'aal2';
}

export interface CookieStore {
  getAll(): { name: string; value: string }[];
  setAll(cookies: { name: string; value: string; options?: Record<string, unknown> }[]): void;
}

export type AuthErrorCode = 'EMAIL_TAKEN' | 'INVALID_CREDENTIALS' | 'INVALID_CODE' | 'EMAIL_NOT_VERIFIED' | 'WEAK_PASSWORD' | 'OAUTH_UNAVAILABLE';
export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
  }
}

export interface AuthProvider {
  readonly kind: 'supabase' | 'dev';
  signUp(email: string, password: string, locale: string): Promise<void>;
  verifyEmail(email: string, code: string): Promise<AuthUser>;
  resendVerification(email: string, locale: string): Promise<void>;
  signIn(email: string, password: string): Promise<AuthUser>;
  oauthUrl(provider: 'google' | 'apple', redirectTo: string): Promise<string>;
  exchangeOAuthCode(code: string): Promise<AuthUser>;
  getUser(): Promise<AuthUser | null>;
  signOut(): Promise<void>;
}

export const MIN_PASSWORD = 10;

/** Supabase Auth: correo con código de 6 dígitos (plantilla con {{ .Token }}), Google, Apple y TOTP. */
export class SupabaseAuth implements AuthProvider {
  readonly kind = 'supabase' as const;
  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    private readonly cookies: CookieStore,
  ) {}

  private client() {
    return createServerClient(this.url, this.anonKey, {
      cookies: { getAll: () => this.cookies.getAll(), setAll: (c) => this.cookies.setAll(c) },
    });
  }

  private async toUser(u: { id: string; email?: string; email_confirmed_at?: string | null } | null): Promise<AuthUser | null> {
    if (!u?.email) return null;
    const { data } = await this.client().auth.mfa.getAuthenticatorAssuranceLevel();
    return { id: u.id, email: u.email, emailVerified: !!u.email_confirmed_at, aal: data?.currentLevel === 'aal2' ? 'aal2' : 'aal1' };
  }

  async signUp(email: string, password: string, locale: string) {
    if (password.length < MIN_PASSWORD) throw new AuthError('WEAK_PASSWORD');
    const { error } = await this.client().auth.signUp({ email, password, options: { data: { locale } } });
    if (error) throw new AuthError(/already/i.test(error.message) ? 'EMAIL_TAKEN' : 'INVALID_CREDENTIALS');
  }
  async verifyEmail(email: string, code: string): Promise<AuthUser> {
    const { data, error } = await this.client().auth.verifyOtp({ email, token: code, type: 'signup' });
    if (error || !data.user) throw new AuthError('INVALID_CODE');
    return (await this.toUser(data.user))!;
  }
  async resendVerification(email: string) {
    await this.client().auth.resend({ type: 'signup', email });
  }
  async signIn(email: string, password: string): Promise<AuthUser> {
    const { data, error } = await this.client().auth.signInWithPassword({ email, password });
    if (error) throw new AuthError(/confirm/i.test(error.message) ? 'EMAIL_NOT_VERIFIED' : 'INVALID_CREDENTIALS');
    return (await this.toUser(data.user))!;
  }
  async oauthUrl(provider: 'google' | 'apple', redirectTo: string) {
    const { data, error } = await this.client().auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
    if (error || !data.url) throw new AuthError('OAUTH_UNAVAILABLE');
    return data.url;
  }
  async exchangeOAuthCode(code: string) {
    const { data, error } = await this.client().auth.exchangeCodeForSession(code);
    if (error) throw new AuthError('INVALID_CODE');
    return (await this.toUser(data.user))!;
  }
  async getUser() {
    const { data } = await this.client().auth.getUser();
    return this.toUser(data.user);
  }
  async signOut() {
    await this.client().auth.signOut();
  }
}

const SESSION_COOKIE = 'pluma_dev_session';

/** Hash scrypt de contraseñas del modo de desarrollo (también lo usa el seed). */
export async function hashDevPassword(password: string) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${(await scrypt(password, salt, 32)).toString('base64')}`;
}
const TTL_MS = 7 * 86_400_000;

/**
 * Autenticación de DESARROLLO sobre la tabla auth.users de la capa de compatibilidad local.
 * Mismo flujo que producción (código de 6 dígitos por correo). Se niega a funcionar en producción.
 */
export class DevAuth implements AuthProvider {
  readonly kind = 'dev' as const;
  constructor(
    private readonly db: Db,
    private readonly cookies: CookieStore,
    private readonly secret: string,
    private readonly mail: EmailSender,
  ) {
    if (process.env.NODE_ENV === 'production' && process.env.PLUMA_ALLOW_DEV_AUTH !== 'yes-i-know') {
      throw new Error('DevAuth no se puede usar en producción');
    }
  }

  private sign(v: string) {
    return createHmac('sha256', this.secret).update(v).digest('base64url');
  }
  private setSession(userId: string) {
    const body = `${userId}.${Date.now() + TTL_MS}`;
    this.cookies.setAll([{ name: SESSION_COOKIE, value: `${body}.${this.sign(body)}`, options: { httpOnly: true, sameSite: 'lax', path: '/', maxAge: TTL_MS / 1000 } }]);
  }
  private hash(password: string) {
    return hashDevPassword(password);
  }
  private async check(password: string, stored: string) {
    const [, salt, hash] = stored.split('$');
    if (!salt || !hash) return false;
    const got = await scrypt(password, Buffer.from(salt, 'base64'), 32);
    return timingSafeEqual(got, Buffer.from(hash, 'base64'));
  }
  private async row(email: string) {
    const r = await this.db.execute<{ id: string; email: string; encrypted_password: string | null; email_confirmed_at: string | null; raw_user_meta_data: Record<string, unknown> }>(
      sql`select id, email, encrypted_password, email_confirmed_at, raw_user_meta_data from auth.users where lower(email) = lower(${email})`,
    );
    return r[0] ?? null;
  }
  private async sendCode(email: string, locale: string) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = createHash('sha256').update(code).digest('hex');
    await this.db.execute(sql`update auth.users set raw_user_meta_data = raw_user_meta_data || ${JSON.stringify({ verify_hash: codeHash, verify_exp: Date.now() + 3_600_000, locale })}::jsonb where lower(email) = lower(${email})`);
    const subject = { es: 'Tu código de Pluma', en: 'Your Pluma code', 'pt-BR': 'Seu código da Pluma' }[locale as 'es'] ?? 'Tu código de Pluma';
    await this.mail.send({ to: email, subject: `${subject}: ${code}`, html: `<p>${code}</p>`, text: code, tag: 'auth_code', idempotencyKey: `auth:${email}:${codeHash}` });
  }

  async signUp(email: string, password: string, locale: string) {
    if (password.length < MIN_PASSWORD) throw new AuthError('WEAK_PASSWORD');
    const existing = await this.row(email);
    if (existing?.email_confirmed_at) throw new AuthError('EMAIL_TAKEN');
    if (!existing) {
      await this.db.execute(sql`insert into auth.users (email, encrypted_password, raw_user_meta_data) values (${email.toLowerCase()}, ${await this.hash(password)}, ${JSON.stringify({ locale })}::jsonb)`);
    } else {
      await this.db.execute(sql`update auth.users set encrypted_password = ${await this.hash(password)} where id = ${existing.id}`);
    }
    await this.sendCode(email, locale);
  }

  async verifyEmail(email: string, code: string): Promise<AuthUser> {
    const r = await this.row(email);
    const meta = r?.raw_user_meta_data as { verify_hash?: string; verify_exp?: number } | undefined;
    const hash = createHash('sha256').update(code.trim()).digest('hex');
    if (!r || !meta?.verify_hash || meta.verify_hash !== hash || (meta.verify_exp ?? 0) < Date.now()) throw new AuthError('INVALID_CODE');
    await this.db.execute(sql`update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()), raw_user_meta_data = raw_user_meta_data - 'verify_hash' - 'verify_exp' where id = ${r.id}`);
    this.setSession(r.id);
    return { id: r.id, email: r.email, emailVerified: true, aal: 'aal2' };
  }

  async resendVerification(email: string, locale: string) {
    const r = await this.row(email);
    if (r && !r.email_confirmed_at) await this.sendCode(email, locale);
  }

  async signIn(email: string, password: string): Promise<AuthUser> {
    const r = await this.row(email);
    if (!r?.encrypted_password || !(await this.check(password, r.encrypted_password))) throw new AuthError('INVALID_CREDENTIALS');
    if (!r.email_confirmed_at) throw new AuthError('EMAIL_NOT_VERIFIED');
    this.setSession(r.id);
    return { id: r.id, email: r.email, emailVerified: true, aal: 'aal2' };
  }

  async oauthUrl(): Promise<string> {
    throw new AuthError('OAUTH_UNAVAILABLE');
  }
  async exchangeOAuthCode(): Promise<AuthUser> {
    throw new AuthError('OAUTH_UNAVAILABLE');
  }

  async getUser(): Promise<AuthUser | null> {
    const raw = this.cookies.getAll().find((c) => c.name === SESSION_COOKIE)?.value;
    if (!raw) return null;
    const i = raw.lastIndexOf('.');
    const body = raw.slice(0, i);
    const sig = raw.slice(i + 1);
    const expected = Buffer.from(this.sign(body));
    if (expected.length !== Buffer.from(sig).length || !timingSafeEqual(expected, Buffer.from(sig))) return null;
    const [id, exp] = body.split('.');
    if (!id || Number(exp) < Date.now()) return null;
    const r = await this.db.execute<{ id: string; email: string; email_confirmed_at: string | null }>(sql`select id, email, email_confirmed_at from auth.users where id = ${id}`);
    const u = r[0];
    return u ? { id: u.id, email: u.email, emailVerified: !!u.email_confirmed_at, aal: 'aal2' } : null;
  }

  async signOut() {
    this.cookies.setAll([{ name: SESSION_COOKIE, value: '', options: { path: '/', maxAge: 0 } }]);
  }
}
