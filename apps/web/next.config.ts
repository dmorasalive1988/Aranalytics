import type { NextConfig } from 'next';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import createNextIntlPlugin from 'next-intl/plugin';

// Monorepo: un solo .env en la raíz para web, admin y worker (las variables ya definidas no se pisan).
const rootEnv = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  transpilePackages: ['@pluma/ui', '@pluma/domain', '@pluma/i18n', '@pluma/services', '@pluma/adapters', '@pluma/db', '@pluma/emails'],
  serverExternalPackages: ['postgres'],
  experimental: {
    // Demos de audio de hasta 40 MB.
    serverActions: { bodySizeLimit: '45mb' },
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withNextIntl(config);
