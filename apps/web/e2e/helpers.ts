import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { MAIL_DIR } from '../playwright.config';

interface Mail { to: string; subject: string; text: string; tag: string }

export function mailsTo(to: string): Mail[] {
  if (!existsSync(MAIL_DIR)) return [];
  return readdirSync(MAIL_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(readFileSync(`${MAIL_DIR}/${f}`, 'utf8')) as Mail).filter((m) => m.to.toLowerCase() === to.toLowerCase());
}

export async function waitForMail(to: string, tag: string): Promise<Mail> {
  let found: Mail | undefined;
  await expect.poll(() => (found = mailsTo(to).filter((m) => m.tag === tag).pop()), { timeout: 15_000 }).toBeTruthy();
  return found!;
}

export const codeIn = (m: Mail) => (m.subject.match(/\b(\d{6})\b/) ?? m.text.match(/\b(\d{6})\b/))![1]!;

export const uniqueEmail = (p: string) => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@e2e.test`;

/** Recorre el onboarding completo en el idioma de la página. */
export async function onboard(page: Page, opts: { email: string; plan: 'Socio' | 'Pro' | 'Sócio'; labels: OnboardingLabels }) {
  const L = opts.labels;
  await page.goto('/bienvenida');
  await page.getByRole('link', { name: L.create }).click();
  await page.getByLabel(L.email).fill(opts.email);
  await page.getByLabel(L.password).fill('clave-segura-e2e-123');
  await page.getByRole('button', { name: L.create }).click();
  await page.waitForURL(/verificar/);
  await page.getByLabel(L.code).fill(codeIn(await waitForMail(opts.email, 'auth_code')));
  await page.getByRole('button', { name: L.verify }).click();
  await page.waitForURL(/onboarding\/perfil/);
  await page.getByLabel(L.legalName).fill('Persona de Prueba E2E');
  await page.getByLabel(L.birthDate).fill('1995-05-20');
  await page.getByRole('button', { name: L.continue }).click();
  await page.waitForURL(/sociedad/);
  await page.getByRole('button', { name: L.continue }).click();
  await page.waitForURL(/onboarding\/plan/);
  await page.getByText(opts.plan, { exact: true }).click();
  await page.getByRole('button', { name: L.continue }).click();
  await page.waitForURL(/contrato/);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: L.sign }).click();
  await page.waitForURL(/onboarding\/pago/);
  await page.getByRole('button', { name: L.pay }).click();
  await page.waitForURL(/dev\/checkout/);
  await page.getByRole('button', { name: /Simul/ }).click();
  await page.waitForURL(/onboarding\/listo/);
}

export interface OnboardingLabels {
  create: string; email: string; password: string; code: string; verify: string; legalName: string; birthDate: string; continue: string; sign: string; pay: RegExp;
}

export const LABELS: Record<'es' | 'en' | 'pt-BR', OnboardingLabels> = {
  es: { create: 'Crear cuenta', email: 'Correo electrónico', password: 'Contraseña', code: 'Código', verify: 'Verificar', legalName: 'Nombre legal completo', birthDate: 'Fecha de nacimiento', continue: 'Continuar', sign: 'Firmar contrato', pay: /Pagar/ },
  en: { create: 'Create account', email: 'Email', password: 'Password', code: 'Code', verify: 'Verify', legalName: 'Full legal name', birthDate: 'Date of birth', continue: 'Continue', sign: 'Sign agreement', pay: /Pay/ },
  'pt-BR': { create: 'Criar conta', email: 'E-mail', password: 'Senha', code: 'Código', verify: 'Verificar', legalName: 'Nome civil completo', birthDate: 'Data de nascimento', continue: 'Continuar', sign: 'Assinar contrato', pay: /Pagar/ },
};
