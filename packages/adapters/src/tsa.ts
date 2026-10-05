import { randomBytes } from 'node:crypto';

/** Codificación DER mínima para la solicitud RFC 3161. */
function der(tag: number, content: Buffer): Buffer {
  const len = content.length;
  let header: Buffer;
  if (len < 0x80) header = Buffer.from([tag, len]);
  else {
    const bytes: number[] = [];
    for (let n = len; n > 0; n >>= 8) bytes.unshift(n & 0xff);
    header = Buffer.from([tag, 0x80 | bytes.length, ...bytes]);
  }
  return Buffer.concat([header, content]);
}
const seq = (...parts: Buffer[]) => der(0x30, Buffer.concat(parts));
const int = (b: Buffer) => der(0x02, b[0]! & 0x80 ? Buffer.concat([Buffer.from([0]), b]) : b);
const SHA256_OID = Buffer.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);
const NULL = Buffer.from([0x05, 0x00]);
const TRUE = Buffer.from([0x01, 0x01, 0xff]);

/** TimeStampReq (RFC 3161 §2.4.1) para un hash SHA-256, con nonce y pidiendo el certificado. */
export function buildTimestampRequest(sha256Hex: string, nonce: Buffer = randomBytes(8)): Buffer {
  const digest = Buffer.from(sha256Hex, 'hex');
  if (digest.length !== 32) throw new Error('se espera un SHA-256');
  return seq(int(Buffer.from([1])), seq(seq(SHA256_OID, NULL), der(0x04, digest)), int(nonce), TRUE);
}

/** Lee PKIStatus de un TimeStampResp: 0 = granted, 1 = grantedWithMods. */
export function timestampResponseStatus(resp: Buffer): number {
  // SEQUENCE { SEQUENCE(PKIStatusInfo) { INTEGER status ... } ... }
  let i = 0;
  const readLen = () => {
    const first = resp[i++]!;
    if (first < 0x80) return first;
    let n = 0;
    for (let k = 0; k < (first & 0x7f); k++) n = (n << 8) | resp[i++]!;
    return n;
  };
  if (resp[i++] !== 0x30) throw new Error('respuesta TSA inválida');
  readLen();
  if (resp[i++] !== 0x30) throw new Error('respuesta TSA inválida');
  readLen();
  if (resp[i++] !== 0x02) throw new Error('respuesta TSA inválida');
  const l = readLen();
  let v = 0;
  for (let k = 0; k < l; k++) v = (v << 8) | resp[i++]!;
  return v;
}

export interface TimestampAuthority {
  /** Devuelve el token (respuesta DER completa) o null si el servicio está desactivado. */
  stamp(sha256Hex: string): Promise<Buffer | null>;
}

export class Rfc3161Tsa implements TimestampAuthority {
  constructor(private readonly url: string) {}
  async stamp(sha256Hex: string) {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/timestamp-query' },
      body: new Uint8Array(buildTimestampRequest(sha256Hex)),
    });
    if (!res.ok) throw new Error(`TSA ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    const status = timestampResponseStatus(body);
    if (status > 1) throw new Error(`TSA rechazó la solicitud (status ${status})`);
    return body;
  }
}

export class DisabledTsa implements TimestampAuthority {
  async stamp() {
    return null;
  }
}
