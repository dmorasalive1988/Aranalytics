import { migrate } from '../migrate';
import { requireDatabaseUrl } from './env';

const r = await migrate(requireDatabaseUrl());
console.log(r.applied.length ? `${r.applied.length} migraciones aplicadas.` : 'La base está al día.');
