import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Bucket = 'audio-originals' | 'audio-previews' | 'documents' | 'statements-raw' | 'kyc';

export interface ObjectStorage {
  /** Escribe una sola vez: si la ruta existe, falla (los archivos de evidencia no se sobrescriben). */
  putOnce(bucket: Bucket, path: string, data: Buffer, contentType: string): Promise<void>;
  get(bucket: Bucket, path: string): Promise<Buffer>;
  signedUrl(bucket: Bucket, path: string, ttlSeconds: number): Promise<string>;
}

const safe = (p: string) => {
  const n = normalize(p).replace(/^(\.\.(\/|\\|$))+/, '');
  if (n.startsWith('/') || n.includes('..')) throw new Error('ruta inválida');
  return n;
};

export class SupabaseStorage implements ObjectStorage {
  private readonly client: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  async putOnce(bucket: Bucket, path: string, data: Buffer, contentType: string) {
    const { error } = await this.client.storage.from(bucket).upload(safe(path), data, { contentType, upsert: false });
    if (error) throw error;
  }
  async get(bucket: Bucket, path: string) {
    const { data, error } = await this.client.storage.from(bucket).download(safe(path));
    if (error) throw error;
    return Buffer.from(await data.arrayBuffer());
  }
  async signedUrl(bucket: Bucket, path: string, ttlSeconds: number) {
    const { data, error } = await this.client.storage.from(bucket).createSignedUrl(safe(path), ttlSeconds);
    if (error) throw error;
    return data.signedUrl;
  }
}

/** Desarrollo: disco local + URLs firmadas con HMAC servidas por la app (/api/dev-storage). */
export class LocalStorage implements ObjectStorage {
  constructor(
    private readonly root: string,
    private readonly publicBase: string,
    private readonly secret: string,
  ) {}
  private file(bucket: Bucket, path: string) {
    return join(this.root, bucket, safe(path));
  }
  async putOnce(bucket: Bucket, path: string, data: Buffer) {
    const f = this.file(bucket, path);
    const exists = await access(f).then(() => true, () => false);
    if (exists) throw new Error('OBJECT_EXISTS');
    await mkdir(dirname(f), { recursive: true });
    await writeFile(f, data);
  }
  get(bucket: Bucket, path: string) {
    return readFile(this.file(bucket, path));
  }
  async signedUrl(bucket: Bucket, path: string, ttlSeconds: number) {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.sign(`${bucket}/${path}:${exp}`);
    return `${this.publicBase}/${bucket}/${path}?exp=${exp}&sig=${sig}`;
  }
  sign(payload: string) {
    return createHmac('sha256', this.secret).update(payload).digest('base64url');
  }
  verify(bucket: string, path: string, exp: number, sig: string) {
    if (exp < Date.now() / 1000) return false;
    const expected = Buffer.from(this.sign(`${bucket}/${path}:${exp}`));
    const got = Buffer.from(sig);
    return expected.length === got.length && timingSafeEqual(expected, got);
  }
}
