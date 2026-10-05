import { migrate, resetDatabase } from '../migrate';
import { requireDatabaseUrl } from './env';

const url = requireDatabaseUrl();
await resetDatabase(url);
await migrate(url);
console.log('Base reiniciada. Para cargar datos de ejemplo: pnpm db:seed');
