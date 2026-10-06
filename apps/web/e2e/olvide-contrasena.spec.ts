import { expect, test } from '@playwright/test';
import { LABELS, codeIn, mailsTo, onboard, uniqueEmail, waitForMail } from './helpers';

/** Olvidé la contraseña: código por correo, contraseña nueva y sesión iniciada; la anterior deja de servir. */
test('restablecer la contraseña con un código', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'es-CO', extraHTTPHeaders: { 'Accept-Language': 'es-CO' } });
  const page = await ctx.newPage();
  const email = uniqueEmail('reset');
  await onboard(page, { email, plan: 'Socio', labels: LABELS.es });
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();

  await page.goto('/entrar');
  await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
  await page.waitForURL(/olvide/);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await page.waitForURL(/restablecer/);

  await page.getByLabel('Código').fill('000000');
  await page.getByLabel('Contraseña nueva').fill('otra-clave-segura-456');
  await page.getByRole('button', { name: 'Guardar y entrar' }).click();
  await expect(page.getByText('Ese código no es válido o ya venció.')).toBeVisible();

  await page.getByLabel('Código').fill(codeIn(await waitForMail(email, 'password_reset')));
  await page.getByRole('button', { name: 'Guardar y entrar' }).click();
  await page.waitForURL(/inicio/);

  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.goto('/entrar');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña').fill('clave-segura-e2e-123');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('El correo o la contraseña no coinciden.')).toBeVisible();
  await page.getByLabel('Contraseña').fill('otra-clave-segura-456');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/inicio/);
  await ctx.close();
});

/** Un correo sin cuenta recibe la misma respuesta (no revela qué cuentas existen) y ningún correo. */
test('no revela si la cuenta existe', async ({ browser }) => {
  const page = await (await browser.newContext({ locale: 'es-CO', extraHTTPHeaders: { 'Accept-Language': 'es-CO' } })).newPage();
  const email = uniqueEmail('nadie');
  await page.goto('/olvide');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await page.waitForURL(/restablecer/);
  await expect(page.getByText(/Si hay una cuenta con/)).toBeVisible();
  expect(mailsTo(email)).toHaveLength(0);
});
