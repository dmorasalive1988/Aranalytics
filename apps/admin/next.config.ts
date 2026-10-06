import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

const rootEnv = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config: NextConfig = {
  // Monorepo: rastrear archivos desde la raíz e incluir las fuentes del PDF en las funciones de Vercel.
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  turbopack: { root: resolve(process.cwd(), '../..') },
  outputFileTracingIncludes: { '/**': ['../../packages/pdf/fonts/**/*'] },
  env: { PLUMA_APP_KIND: 'admin' },
  transpilePackages: ['@pluma/ui', '@pluma/domain', '@pluma/i18n', '@pluma/services', '@pluma/adapters', '@pluma/db', '@pluma/emails'],
  serverExternalPackages: ['postgres'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }];
  },
};
export default config;
