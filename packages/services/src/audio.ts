import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, inArray, t, withSystem } from '@pluma/db';
import { DomainError } from '@pluma/domain';
import { sha256 } from './crypto';
import type { Deps, RequestCtx } from './deps';
import { MAX_DEMO_BYTES } from './works';

const AUDIO_TYPES: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg', 'audio/flac': 'flac' };
const MIME: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', flac: 'audio/flac' };

let ffmpegChecked: string | null | undefined;
/** Ruta de ffmpeg si está instalado (worker y desarrollo). En Vercel no hay: el demo se guarda sin marca de agua. */
function ffmpegPath(): string | null {
  if (ffmpegChecked !== undefined) return ffmpegChecked;
  const bin = process.env.PLUMA_FFMPEG || 'ffmpeg';
  try {
    ffmpegChecked = spawnSync(bin, ['-version'], { timeout: 5000 }).status === 0 ? bin : null;
  } catch {
    ffmpegChecked = null;
  }
  return ffmpegChecked;
}

/**
 * Versión de escucha: MP3 128 kbps con una marca audible (dos notas breves cada 25 s) y el identificador
 * de la marca en los metadatos. El original nunca se sirve.
 */
function watermark(input: Buffer, watermarkId: string): Promise<Buffer> {
  const bin = ffmpegPath()!;
  return new Promise((resolve, reject) => {
    const p = spawn(bin, [
      '-hide_banner', '-loglevel', 'error', '-i', 'pipe:0',
      '-filter_complex',
      // Tono de 0,35 s (1760 Hz y luego 1320 Hz) al segundo 3 y cada 25 s, mezclado bajo la música.
      "aevalsrc='0.10*sin(2*PI*1760*t)*between(mod(t-3,25),0,0.17)+0.10*sin(2*PI*1320*t)*between(mod(t-3,25),0.18,0.35)':s=44100[wm];[0:a]aresample=44100[a];[a][wm]amix=inputs=2:duration=first:normalize=0[out]",
      '-map', '[out]', '-ac', '2', '-b:a', '128k', '-metadata', `comment=pluma:${watermarkId}`, '-f', 'mp3', 'pipe:1',
    ]);
    const chunks: Buffer[] = [];
    let err = '';
    p.stdout.on('data', (c: Buffer) => chunks.push(c));
    p.stderr.on('data', (c: Buffer) => (err += c.toString()));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 && chunks.length ? resolve(Buffer.concat(chunks)) : reject(new Error(`ffmpeg: ${err.slice(0, 300)}`))));
    p.stdin.on('error', () => {});
    p.stdin.end(input);
  });
}

/** Picos 0–100 de la señal (forma de onda de los resultados). Null sin ffmpeg. */
function waveformPeaks(input: Buffer, bars = 64): Promise<number[] | null> {
  const bin = ffmpegPath();
  if (!bin) return Promise.resolve(null);
  return new Promise((resolve) => {
    const p = spawn(bin, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', '2000', '-f', 's16le', 'pipe:1']);
    const chunks: Buffer[] = [];
    p.stdout.on('data', (c: Buffer) => chunks.push(c));
    p.on('error', () => resolve(null));
    p.on('close', (code) => {
      const pcm = Buffer.concat(chunks);
      const n = Math.floor(pcm.length / 2);
      if (code !== 0 || n < bars) return resolve(null);
      const per = Math.floor(n / bars);
      const peaks = Array.from({ length: bars }, (_, b) => {
        let max = 0;
        for (let i = b * per; i < (b + 1) * per; i++) max = Math.max(max, Math.abs(pcm.readInt16LE(i * 2)));
        return max;
      });
      const top = Math.max(...peaks, 1);
      resolve(peaks.map((v) => Math.round((v / top) * 100)));
    });
    p.stdin.on('error', () => {});
    p.stdin.end(input);
  });
}

/** Versión de escucha protegida: MP3 con marca de agua si hay ffmpeg; si no, el archivo tal cual. */
async function makePreview(bytes: Buffer, ext: string) {
  const wmId = randomBytes(8).toString('hex');
  if (ffmpegPath()) {
    try {
      return { bytes: await watermark(bytes, wmId), ext: 'mp3', watermarkId: wmId as string | null, waveform: await waveformPeaks(bytes) };
    } catch (e) {
      console.error('[audio] no se pudo generar la marca de agua', (e as Error).message);
    }
  }
  return { bytes, ext, watermarkId: null as string | null, waveform: null as number[] | null };
}

/**
 * Versión de escucha del demo de una obra (catálogos A&R y Sync). Idempotente por hash del demo vigente.
 * Devuelve el id del archivo o null si la obra no tiene demo.
 */
export async function ensureWorkPreview(deps: Deps, workId: string): Promise<string | null> {
  const [w] = await deps.db.select({ sha: t.works.audioSha256, owner: t.works.createdBy }).from(t.works).where(eq(t.works.id, workId));
  if (!w?.sha) return null;
  const [existing] = await deps.db.select({ id: t.workFiles.id, path: t.workFiles.storagePath }).from(t.workFiles).where(and(eq(t.workFiles.workId, workId), eq(t.workFiles.kind, 'demo_preview')));
  if (existing?.path.includes(w.sha)) return existing.id;
  const [orig] = await deps.db.select().from(t.workFiles).where(and(eq(t.workFiles.workId, workId), eq(t.workFiles.kind, 'demo_original'), eq(t.workFiles.sha256, w.sha)));
  if (!orig) return null;
  const [bucket, ...rest] = orig.storagePath.split('/');
  const bytes = await deps.storage.get(bucket as 'audio-originals', rest.join('/'));
  const ext = orig.storagePath.split('.').pop() ?? 'mp3';
  const p = await makePreview(bytes, ext);
  const path = `works/${workId}/${w.sha}-${p.watermarkId ?? 'plain'}.${p.ext}`;
  await deps.storage.putOnce('audio-previews', path, p.bytes, MIME[p.ext] ?? 'audio/mpeg').catch((e: Error) => {
    if (e.message !== 'OBJECT_EXISTS' && !/exists/i.test(e.message)) throw e;
  });
  return withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'catalog.preview' }, async (tx) => {
    if (existing) await tx.delete(t.workFiles).where(eq(t.workFiles.id, existing.id));
    const [row] = await tx
      .insert(t.workFiles)
      .values({ workId, ownerUserId: w.owner, kind: 'demo_preview', storagePath: `audio-previews/${path}`, sha256: sha256(p.bytes), watermarkId: p.watermarkId, waveform: p.waveform })
      .onConflictDoUpdate({ target: t.workFiles.storagePath, set: { waveform: p.waveform } })
      .returning({ id: t.workFiles.id });
    return row!.id;
  });
}

/**
 * Demo para la red (solicitud o muestra de postulación): guarda el original y una versión de escucha protegida.
 * Devuelve el id de la versión de escucha (la única que se reproduce).
 */
export async function storeNetworkDemo(deps: Deps, userId: string, file: { bytes: Buffer; mime: string }, ctx: RequestCtx): Promise<string> {
  const ext = AUDIO_TYPES[file.mime];
  if (!ext) throw new DomainError('AUDIO_TYPE_UNSUPPORTED');
  if (file.bytes.length === 0 || file.bytes.length > MAX_DEMO_BYTES) throw new DomainError('AUDIO_TOO_LARGE');
  const hash = sha256(file.bytes);
  const originalPath = `network/${userId}/${hash}.${ext}`;
  const made = await makePreview(file.bytes, ext);
  const preview = made.bytes;
  const previewExt = made.ext;
  const marked = !!made.watermarkId;
  const wmId = made.watermarkId ?? '';
  const previewPath = `network/${userId}/${hash}-${marked ? wmId : 'plain'}.${previewExt}`;
  const ignoreExisting = (e: Error) => {
    if (e.message !== 'OBJECT_EXISTS' && !/exists/i.test(e.message)) throw e;
  };
  await deps.storage.putOnce('audio-originals', originalPath, file.bytes, file.mime).catch(ignoreExisting);
  await deps.storage.putOnce('audio-previews', previewPath, preview, MIME[previewExt] ?? file.mime).catch(ignoreExisting);
  return withSystem(deps.db, { actorId: userId, actorRole: 'writer', command: 'network.upload_demo', ...ctx }, async (tx) => {
    await tx.insert(t.workFiles).values({ ownerUserId: userId, kind: 'network_demo_original', storagePath: `audio-originals/${originalPath}`, sha256: hash }).onConflictDoNothing();
    const [row] = await tx
      .insert(t.workFiles)
      .values({ ownerUserId: userId, kind: 'network_demo_preview', storagePath: `audio-previews/${previewPath}`, sha256: sha256(preview), watermarkId: marked ? wmId : null, waveform: made.waveform })
      .onConflictDoUpdate({ target: t.workFiles.storagePath, set: { ownerUserId: userId } })
      .returning({ id: t.workFiles.id });
    return row!.id;
  });
}

/**
 * ¿Puede escuchar? Quien subió el archivo; cualquier miembro de la red si es el demo de una solicitud visible;
 * quien publicó, si es la muestra de una postulación a su solicitud. Cada escucha queda registrada.
 */
export async function authorizePlay(deps: Deps, viewerId: string, fileId: string, ip: string | null) {
  const [f] = await deps.db.select().from(t.workFiles).where(and(eq(t.workFiles.id, fileId), inArray(t.workFiles.kind, ['network_demo_preview', 'demo_preview'])));
  if (!f) return null;
  let context: string | null = f.ownerUserId === viewerId ? 'owner' : null;
  if (!context && f.kind === 'demo_preview' && f.workId) {
    // Catálogos: A&R invitados (obras sin grabar con opt-in) y compradores de sync (obras con opt-in de sync).
    const { catalogAccess } = await import('./catalog');
    context = await catalogAccess(deps, viewerId, f.workId);
  }
  if (!context && f.kind === 'network_demo_preview') {
    const [req] = await deps.db.select({ id: t.networkRequests.id }).from(t.networkRequests).where(and(eq(t.networkRequests.demoFileId, fileId), eq(t.networkRequests.status, 'open')));
    if (req) {
      const { assertNetworkMember } = await import('./network');
      if (await assertNetworkMember(deps, viewerId).then(() => true, () => false)) context = 'network';
    }
    if (!context) {
      const [app] = await deps.db
        .select({ id: t.applications.id })
        .from(t.applications)
        .innerJoin(t.networkRequests, eq(t.networkRequests.id, t.applications.requestId))
        .where(and(eq(t.applications.sampleFileId, fileId), eq(t.networkRequests.authorUserId, viewerId)));
      if (app) context = 'network';
    }
  }
  if (!context) return null;
  await deps.db.insert(t.audioPlays).values({ fileId, listenerUserId: viewerId, context, ipHash: ip ? createHash('sha256').update(`${deps.signingSecret}:${ip}`).digest('hex') : null });
  const [bucket, ...rest] = f.storagePath.split('/');
  // URL firmada de 60 s: suficiente para empezar a reproducir, inútil para compartir.
  return { url: await deps.storage.signedUrl(bucket as 'audio-previews', rest.join('/'), 60), watermarked: !!f.watermarkId };
}
