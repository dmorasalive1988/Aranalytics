import { expect, test } from '@playwright/test';
import { LABELS, codeIn, mailsTo, uniqueEmail, waitForMail } from './helpers';

const L = LABELS.es;

test('sitio: las 13 secciones en orden y el hero con "Hazte socio" sin hacer scroll en el celular', async ({ page, context }) => {
  // Primera visita: "/" lleva al idioma del navegador (el de las pruebas está en inglés).
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForURL(/\/en$/);
  // Con el español elegido (cookie que deja el sitio o el perfil), "/" lleva a /es.
  await context.addCookies([{ name: 'PLUMA_LOCALE', value: 'es', url: 'http://localhost:3100' }]);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForURL(/\/es$/);
  await expect(page.locator('header').first()).toBeVisible();
  const headings = await page.locator('main > section').evaluateAll((els) => els.map((s) => s.querySelector('h1, h2')?.textContent?.trim() ?? ''));
  expect(headings).toEqual([
    'Donde nacen las canciones.',
    'Escribir es lo tuyo. Cobrar no debería ser un misterio.',
    'Escribe. Firma. Cobra.',
    'Encuentra con quién escribir tu próxima canción.',
    'Tu música en cine, series, publicidad y videojuegos.',
    'Cobra en todo el mundo. Mira cada centavo.',
    'Un split es la parte de la canción que te toca.',
    'Lo mejor de una editora, sin cerrarte la puerta.',
    'Dos planes. Sin letra pequeña.',
    'Lo que todo autor pregunta.',
    'Para supervisores y A&Rs',
    'Tu canción. Tu firma. Tu plata.',
  ]);
  await expect(page.locator('body > footer')).toBeVisible();

  const vh = page.viewportSize()!.height;
  for (const el of [page.getByRole('heading', { level: 1 }), page.getByText('Pluma registra tus obras, firma tus splits'), page.locator('main').getByRole('link', { name: 'Hazte socio' }).first()]) {
    const box = (await el.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(vh);
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
});

test('sitio: la calculadora muestra el neto de cada plan y desde cuánto conviene Pro', async ({ page }) => {
  await page.goto('/es#precios', { waitUntil: 'networkidle' });
  await expect(page.getByText('Pro te conviene desde USD 600 al año.')).toBeVisible();
  const slider = page.getByRole('slider', { name: '¿Cuánto recaudan tus obras al año?' });
  const net = (label: string) => page.locator('dl dt', { hasText: label }).locator('xpath=following-sibling::dd');

  await slider.fill('600');
  await expect(net('Recibes con Socio')).toHaveText('USD 460');
  await expect(net('Recibes con Pro')).toHaveText('USD 460');
  await expect(page.getByText('Con este monto, los dos planes te dejan lo mismo.')).toBeVisible();

  await slider.fill('20000');
  await expect(net('Recibes con Socio')).toHaveText('USD 15.980');
  await expect(net('Recibes con Pro')).toHaveText('USD 16.950');
  await expect(page.getByText('Con este monto, Pro te deja USD 970 más al año.')).toBeVisible();

  await slider.fill('300');
  await expect(net('Recibes con Socio')).toHaveText('USD 220');
  await expect(net('Recibes con Pro')).toHaveText('USD 205');
  await expect(page.getByText('Con este monto, Socio te deja USD 15 más al año.')).toBeVisible();
});

test('sitio: "Elegir Socio" lleva al registro con el plan y el idioma preseleccionados', async ({ page, context }) => {
  await context.addCookies([{ name: 'PLUMA_LOCALE', value: 'en', url: 'http://localhost:3100' }]);
  await page.goto('/es#precios');
  await page.getByRole('link', { name: 'Elegir Socio' }).click();
  await page.waitForURL(/\/registro\?lang=es&plan=socio/);
  await expect(page.getByText('Elegiste el plan Socio.')).toBeVisible();

  const email = uniqueEmail('sitio');
  await page.getByLabel(L.email).fill(email);
  await page.getByLabel(L.password).fill('clave-segura-e2e-123');
  await page.getByRole('button', { name: L.create }).click();
  await page.waitForURL(/verificar/);
  await page.getByLabel(L.code).fill(codeIn(await waitForMail(email, 'auth_code')));
  await page.getByRole('button', { name: L.verify }).click();
  await page.waitForURL(/onboarding\/perfil/);
  await page.getByLabel(L.legalName).fill('Persona del Sitio');
  await page.getByLabel(L.birthDate).fill('1995-05-20');
  await page.getByRole('button', { name: L.continue }).click();
  await page.waitForURL(/sociedad/);
  await page.getByRole('button', { name: L.continue }).click();
  await page.waitForURL(/onboarding\/plan/);
  await expect(page.getByRole('radio', { name: /^Socio/ })).toBeChecked();
});

test('sitio: páginas legales con marcador, sin texto inventado', async ({ page }) => {
  for (const slug of ['terminos', 'privacidad', 'contrato']) {
    await page.goto(`/es/${slug}`);
    await expect(page.getByText('[texto legal a definir]')).toBeVisible();
  }
});

test('sitio en inglés y portugués: textos nativos, selector de idioma y registro en el idioma elegido', async ({ page }) => {
  await page.goto('/en', { waitUntil: 'networkidle' });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Where songs are born.');
  await expect(page.getByRole('heading', { name: 'Write it. Own it. Get paid.' })).toBeVisible();
  await page.locator('#precios').scrollIntoViewIfNeeded();
  await expect(page.getByText('Pro pays off from USD 600 a year.')).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('navigation', { name: 'Language' }).first().getByRole('link', { name: 'Português' }).click();
  await page.waitForURL(/\/pt$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Onde as músicas nascem.');
  await page.getByRole('link', { name: 'Escolher Sócio' }).click();
  await page.waitForURL(/\/registro\?lang=pt&plan=socio/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.getByText('Você escolheu o plano Sócio.')).toBeVisible();
});

test('sitio: el formulario de compradores de sync guarda el contacto y avisa al equipo', async ({ page }) => {
  await page.goto('/en/sync', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Original Latin music, ready to license.');
  // Buscador de muestra: convierte el texto en filtros.
  await page.getByLabel('Describe the music you’re looking for').fill('upbeat cumbia female vocals 95-105 bpm one-stop');
  await expect(page.getByText('cumbia', { exact: true })).toBeVisible();
  await expect(page.getByText('95–105')).toBeVisible();

  const email = uniqueEmail('super');
  await page.getByLabel('Name').fill('Sol Supervisor');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Company').fill('Agencia Faro');
  await page.getByLabel('Message').fill('Need a cumbia for a summer ad in Miami.');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Got it. The team will email you soon.')).toBeVisible();
  await expect.poll(() => mailsTo('equipo@e2e.test').filter((m) => m.subject.includes('comprador de sync') && m.text.includes(email.toLowerCase())).length, { timeout: 15_000 }).toBe(1);
});

test('sitio: el formulario de A&R guarda la solicitud de acceso y avisa al equipo', async ({ page }) => {
  await page.goto('/pt/ar', { waitUntil: 'networkidle' });
  const email = uniqueEmail('ar');
  await page.getByLabel('Nome').fill('Ana A&R');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Gravadora ou equipe de artista').fill('Selo Andino');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByText('Recebido. A equipe vai te escrever em breve.')).toBeVisible();
  await expect.poll(() => mailsTo('equipo@e2e.test').filter((m) => m.subject.includes('A&R') && m.text.includes(email.toLowerCase())).length, { timeout: 15_000 }).toBe(1);
});
