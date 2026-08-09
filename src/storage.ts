import { randomInt } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fetch } from "undici";
import { DESKTOP_UA, dispatcher } from "./utils";

const DIR = path.join(process.cwd(), "downloads");
const TTL_MS = 3 * 60 * 1000; // 3 minutos
const MAX_BYTES = 1500 * 1024 * 1024; // 1.5 GB
const ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export interface StoredFile {
  id: string;
  filename: string;
  mime: string;
  size: number;
  ext: string;
  createdAt: number;
  filePath: string;
}

function generateId(length = 8): string {
  let id = "";
  for (let i = 0; i < length; i++) {
    id += ALPHABET[randomInt(ALPHABET.length)];
  }
  return id;
}

async function ensureDir(): Promise<void> {
  await mkdir(DIR, { recursive: true });
}

/** Descarga un stream web (undici) a disco con límite de tamaño y progreso. */
async function streamWebToDisk(
  body: ReadableStream<Uint8Array>,
  filePath: string,
  onProgress?: (written: number, total: number) => void,
  total = 0
): Promise<number> {
  let written = 0;
  const sink = createWriteStream(filePath);
  try {
    for await (const chunk of Readable.fromWeb(body as any)) {
      written += chunk.length;
      if (written > MAX_BYTES) {
        throw new Error("El archivo supera el límite de 1.5 GB.");
      }
      if (!sink.write(chunk)) {
        await new Promise<void>((resolve) => sink.once("drain", resolve));
      }
      onProgress?.(written, total);
    }
    await new Promise<void>((resolve, reject) => {
      sink.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
  } catch (error) {
    sink.destroy();
    throw error;
  }
  return written;
}

/** Descarga un stream de Node (axios) a disco con límite de tamaño y progreso. */
async function streamNodeToDisk(
  stream: NodeJS.ReadableStream,
  filePath: string,
  onProgress?: (written: number, total: number) => void,
  total = 0
): Promise<number> {
  let written = 0;
  const sink = createWriteStream(filePath);
  const source = stream as Readable;
  source.on("data", (chunk: Buffer) => {
    written += chunk.length;
    if (written > MAX_BYTES) {
      source.destroy();
      sink.destroy(new Error("El archivo supera el límite de 1.5 GB."));
    }
    onProgress?.(written, total);
  });
  await pipeline(source, sink);
  return written;
}

export interface SaveOptions {
  filename: string;
  mime: string;
  ext: string;
  /** Cabeceras extra para la petición de descarga (p. ej. Referer). */
  headers?: Record<string, string>;
}

/** Guarda un video descargado vía undici (web stream). */
export async function saveVideoBuffer(
  url: string,
  opts: SaveOptions,
  onProgress?: (written: number, total: number) => void
): Promise<StoredFile> {
  await ensureDir();
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": DESKTOP_UA,
      ...(opts.headers || {}),
    },
    dispatcher,
    redirect: "follow",
  });
  if (!response.ok || !response.body) {
    throw new Error(`No se pudo descargar el video (HTTP ${response.status}).`);
  }
  const total = Number(response.headers.get("content-length") || 0);
  const id = generateId();
  const tmpPath = path.join(DIR, `.${id}.part`);
  const filePath = path.join(DIR, `${id}.${opts.ext}`);
  const size = await streamWebToDisk(response.body, tmpPath, onProgress, total);
  await rename(tmpPath, filePath);
  return finalize(id, filePath, opts, size);
}

/** Guarda un audio descargado vía axios (stream de Node). */
export async function saveAudioBuffer(
  stream: NodeJS.ReadableStream,
  opts: SaveOptions,
  onProgress?: (written: number, total: number) => void
): Promise<StoredFile> {
  await ensureDir();
  const total = Number(
    (stream as any)?.headers?.["content-length"] || 0
  );
  const id = generateId();
  const tmpPath = path.join(DIR, `.${id}.part`);
  const filePath = path.join(DIR, `${id}.${opts.ext}`);
  const size = await streamNodeToDisk(stream, tmpPath, onProgress, total);
  await rename(tmpPath, filePath);
  return finalize(id, filePath, opts, size);
}

async function finalize(
  id: string,
  filePath: string,
  opts: SaveOptions,
  size: number
): Promise<StoredFile> {
  const record: StoredFile = {
    id,
    filename: opts.filename,
    mime: opts.mime,
    size,
    ext: opts.ext,
    createdAt: Date.now(),
    filePath,
  };
  await writeFile(
    path.join(DIR, `${id}.json`),
    JSON.stringify(record),
    "utf-8"
  );
  return record;
}

const ID_PATTERN = /^[A-Za-z0-9]{6,10}$/;

export async function resolveFile(id: string): Promise<StoredFile | null> {
  if (!ID_PATTERN.test(id)) return null;
  try {
    const raw = await readFile(path.join(DIR, `${id}.json`), "utf-8");
    return JSON.parse(raw) as StoredFile;
  } catch {
    return null;
  }
}

export function createFileStream(record: StoredFile) {
  return createReadStream(record.filePath);
}

export function getTTLSeconds(): number {
  return Math.round(TTL_MS / 1000);
}

/** Elimina archivos más viejos que TTL. Se ejecuta al arrancar y cada hora. */
export async function cleanupOldFiles(): Promise<number> {
  try {
    await ensureDir();
    const entries = await import("node:fs/promises").then((m) =>
      m.readdir(DIR, { withFileTypes: true })
    );
    const cutoff = Date.now() - TTL_MS;
    let removed = 0;
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const isJson = entry.name.endsWith(".json");
      const isMedia = /\.(mp4|mp3)$/.test(entry.name);
      if (!isJson && !isMedia) continue;
      const filePath = path.join(DIR, entry.name);
      const stats = await import("node:fs/promises").then((m) =>
        m.stat(filePath).catch(() => null)
      );
      if (stats && stats.mtimeMs < cutoff) {
        await rm(filePath, { force: true });
        removed++;
      }
    }
    return removed;
  } catch {
    return 0;
  }
}
