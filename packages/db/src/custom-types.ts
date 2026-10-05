import { customType } from 'drizzle-orm/pg-core';

export const citext = customType<{ data: string }>({ dataType: () => 'citext' });
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });
export const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });
