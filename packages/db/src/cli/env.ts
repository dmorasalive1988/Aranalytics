export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Falta DATABASE_URL (ver .env.example).');
    process.exit(1);
  }
  return url;
}
