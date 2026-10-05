// Convierte la salida de `drizzle-kit pull` en src/schema.ts utilizable:
// tipos personalizados para citext/bytea/tsvector y sin las políticas RLS (viven en las migraciones SQL).
import { readFileSync, writeFileSync } from 'node:fs';

let s = readFileSync('drizzle/schema.ts', 'utf8');
s = s.replace(/\t\/\/ TODO: failed to parse database type '(\w+)'\n(\t\w+: )unknown\(/g, (_m, type, prefix) => `${prefix}${type}(`);
// Defaults que drizzle-kit introspecta mal
s = s.split(".default(')").join(".default('')");
s = s.split('.default([""])').join('.default(sql`\'{}\'`)');
s = s.replace(/^\s*pgPolicy\(.*\),?\n/gm, '');
s = s.replace(/, pgPolicy/, '');
s = s.replace(/,\s*\(table\) => \[\s*\]\)/g, ')');
s = s.replace(
  'import { sql } from "drizzle-orm"',
  'import { sql } from "drizzle-orm"\nimport { citext, bytea, tsvector } from "./custom-types"',
);
writeFileSync(
  'src/schema.ts',
  '// GENERADO por `pnpm --filter @pluma/db introspect` + scripts/postprocess-schema.mjs. No editar a mano.\n' + s,
);
let r = readFileSync('drizzle/relations.ts', 'utf8').replace('from "./schema"', 'from "./schema"');
writeFileSync('src/relations.ts', '// GENERADO. No editar a mano.\n' + r);
console.log('src/schema.ts y src/relations.ts actualizados');
