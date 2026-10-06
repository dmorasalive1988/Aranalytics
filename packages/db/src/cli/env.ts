import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { directDatabaseUrl } from '../env';

/** Las CLI leen el .env de la raíz del monorepo (las variables ya definidas no se pisan). */
const rootEnv = resolve(import.meta.dirname, '../../../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export function requireDatabaseUrl(): string {
  const url = directDatabaseUrl();
  if (!url) {
    console.error('Falta DATABASE_URL (ver .env.example).');
    process.exit(1);
  }
  return url;
}
