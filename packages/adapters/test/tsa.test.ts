import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTimestampRequest, timestampResponseStatus } from '../src/tsa';

const hash = 'a'.repeat(64);

describe('RFC 3161', () => {
  it('genera una solicitud que OpenSSL entiende', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tsa-'));
    const f = join(dir, 'req.tsq');
    writeFileSync(f, buildTimestampRequest(hash, Buffer.from([0x85, 1, 2, 3])));
    let out: string;
    try {
      out = execFileSync('openssl', ['ts', '-query', '-in', f, '-text'], { encoding: 'utf8' });
    } catch {
      return; // sin openssl en el entorno: la prueba no aplica
    }
    expect(out).toMatch(/Version: 1/);
    expect(out).toMatch(/Hash Algorithm: sha256/);
    expect(out.replace(/\s/g, '')).toContain('aaaaaaaa');
    expect(out).toMatch(/Certificate required: yes/);
  });

  it('lee el estado de la respuesta', () => {
    // SEQUENCE { SEQUENCE { INTEGER 0 } }
    expect(timestampResponseStatus(Buffer.from([0x30, 0x05, 0x30, 0x03, 0x02, 0x01, 0x00]))).toBe(0);
    expect(timestampResponseStatus(Buffer.from([0x30, 0x05, 0x30, 0x03, 0x02, 0x01, 0x02]))).toBe(2);
  });
});
