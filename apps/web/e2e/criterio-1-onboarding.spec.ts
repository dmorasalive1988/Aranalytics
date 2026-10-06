import { expect, test } from '@playwright/test';
import { LABELS, onboard, uniqueEmail } from './helpers';

/**
 * Criterio 1: un autor elige plan y completa onboarding, contrato y pago en menos de 5 minutos, en
 * cualquiera de los tres idiomas. Un autor Socio no puede activar sync ni A&R hasta mejorar a Pro.
 */
for (const [locale, acceptLanguage, plan] of [['es', 'es-CO', 'Socio'], ['en', 'en-US', 'Pro'], ['pt-BR', 'pt-BR', 'Sócio']] as const) {
  test(`onboarding completo en ${locale} en menos de 5 minutos`, async ({ browser }) => {
    const context = await browser.newContext({ locale: acceptLanguage, extraHTTPHeaders: { 'Accept-Language': acceptLanguage } });
    const page = await context.newPage();
    const started = Date.now();
    await onboard(page, { email: uniqueEmail(`c1-${locale}`), plan, labels: LABELS[locale] });
    expect(Date.now() - started).toBeLessThan(5 * 60_000);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await page.goto('/inicio');
    await expect(page.getByRole('navigation')).toBeVisible();
    await context.close();
  });
}

test('Socio no puede activar sync ni A&R hasta mejorar a Pro', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'es-CO', extraHTTPHeaders: { 'Accept-Language': 'es-CO' } });
  const page = await context.newPage();
  await onboard(page, { email: uniqueEmail('c1-gate'), plan: 'Socio', labels: LABELS.es });

  await page.goto('/obras/nueva');
  await page.getByLabel('Título', { exact: true }).fill('Obra sin grabar');
  await page.getByLabel('Género').fill('Bolero');
  await page.getByLabel('No, la escribí sin IA').check();
  await page.getByRole('button', { name: 'Guardar y seguir' }).click();
  await page.waitForURL(/archivos/);
  const workUrl = page.url().replace('/archivos', '');

  await page.goto(workUrl);
  await expect(page.getByText('Disponible en el plan Pro.')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Catálogo de sync' })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Catálogo A&R (obra sin grabar)' })).toBeDisabled();

  await page.getByRole('link', { name: 'Mejorar a Pro' }).click();
  // La analítica es solo de Pro: Socio no ve la pestaña en escritorio y la página invita a mejorar.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/inicio');
  await expect(page.getByRole('link', { name: 'Obras', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Analítica', exact: true })).toHaveCount(0);
  await page.goto('/analitica');
  await expect(page.getByText('La analítica avanzada es del plan Pro')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/cuenta/plan');

  await page.getByRole('button', { name: /Mejorar a Pro por/ }).click();
  await expect(page.getByText(/Ya eres Pro/)).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/inicio');
  await expect(page.getByRole('link', { name: 'Analítica', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(workUrl);
  const sync = page.getByRole('switch', { name: 'Catálogo de sync' });
  await expect(sync).toBeEnabled();
  await sync.click();
  await expect(sync).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Catálogo de sync' })).toHaveAttribute('aria-checked', 'true');
  await context.close();
});
