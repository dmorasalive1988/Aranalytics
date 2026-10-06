import { defineConfig } from '@playwright/test';

export const PORT = 3100;
export const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/pluma_e2e';
export const MAIL_DIR = '/tmp/pluma-e2e-mail';

/** Pruebas de punta a punta de los criterios de aceptación, con pagos simulados y correo local. */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 390, height: 844 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `next dev --port ${PORT}`,
    port: PORT,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: E2E_DB,
      PLUMA_APP_URL: `http://localhost:${PORT}`,
      PLUMA_SIGN_URL: `http://localhost:${PORT}/firmar`,
      PLUMA_AUTH_MODE: 'dev',
      PLUMA_PAYMENTS: 'fake',
      PLUMA_EMAIL: 'dev',
      PLUMA_DEV_MAIL_DIR: MAIL_DIR,
      PLUMA_INLINE_DISPATCH: '1',
      PLUMA_WHATSAPP: 'dev',
      PLUMA_SIGNING_SECRET: 'e2e-secret',
      PLUMA_TEAM_EMAIL: 'equipo@e2e.test',
      NEXT_DIST_DIR: '.next-e2e',
    },
  },
});
