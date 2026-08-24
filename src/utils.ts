import { Agent, fetch } from "undici";

export const dispatcher = new Agent({ maxHeaderSize: 65536 });

export const ANDROID_UA =
  "com.google.android.youtube/20.10.38 (Linux; U; Android 14)";

export const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function withTimeout(
  signal: AbortSignal | undefined,
  ms: number
): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  return AbortSignal.any([signal, timeout]);
}

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const patterns: RegExp[] = [
    /youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/|v\/)([\w-]{11})/i,
    /youtu\.be\/([\w-]{11})/i,
    /[?&]v=([\w-]{11})/i,
    /^([\w-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function sanitizeFilename(title: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "youtube-download";
}

/**
 * Convierte una URL que devolvió un proveedor en una URL HTTP segura y válida.
 * Algunos proveedores devuelven rutas con espacios; URL se ocupa de codificarlos.
 */
export function normalizeHttpUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("El servidor no devolvió un enlace de descarga.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("El servidor devolvió un enlace de descarga inválido.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("El servidor devolvió un protocolo de descarga no permitido.");
  }

  return parsed.toString();
}

export interface MediaProbeOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Comprueba una URL de medio antes de que gane una carrera de scrapers.
 * Solo se lee el primer chunk (máx. 64 KiB solicitados) y después se cancela
 * el stream: evita elegir una página de error HTML con estado 200 sin descargar
 * el archivo entero dos veces.
 */
export async function probeMediaUrl(
  url: string,
  { signal, headers = {}, timeout = 30000 }: MediaProbeOptions = {}
): Promise<string> {
  const normalized = normalizeHttpUrl(url);
  const response = await fetch(normalized, {
    method: "GET",
    headers: {
      Range: "bytes=0-65535",
      "User-Agent": DESKTOP_UA,
      ...headers,
    },
    dispatcher,
    redirect: "follow",
    signal: withTimeout(signal, timeout),
  });

  if ((!response.ok && response.status !== 206) || !response.body) {
    throw new Error(`El enlace de descarga respondió HTTP ${response.status}.`);
  }

  const reader = response.body.getReader();
  try {
    const { done, value } = await reader.read();
    if (done || !value?.byteLength) {
      throw new Error("El enlace de descarga no devolvió contenido.");
    }

    // Las páginas de error de algunos conversores responden 200. Detectamos
    // sus cabeceras HTML/JSON sin imponer un content-type, porque muchos CDN
    // sirven MP3/MP4 como application/octet-stream o sin tipo.
    const sample = Buffer.from(value.subarray(0, 256))
      .toString("latin1")
      .trimStart()
      .toLowerCase();
    if (
      sample.startsWith("<!doctype") ||
      sample.startsWith("<html") ||
      sample.startsWith("<head") ||
      sample.startsWith('{"error"') ||
      sample.startsWith('{"message"')
    ) {
      throw new Error("El enlace de descarga devolvió una página de error.");
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return normalizeHttpUrl(response.url || normalized);
}

interface TrackHeader {
  width: number;
  height: number;
}

// lee el box tkhd dentro del moov para sacar la resolución del mp4
function findTrackHeader(
  buffer: Buffer,
  start: number,
  end: number,
  depth = 0
): TrackHeader | null {
  if (depth > 16 || end > buffer.length) return null;

  let offset = start;
  while (offset + 8 <= end) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    if (size < 8 || size > buffer.length - offset) break;

    if (type === "trak") {
      const found = findTrackHeader(buffer, offset + 8, offset + size, depth + 1);
      if (found) return found;
    } else if (type === "tkhd") {
      const base = offset + 12;
      const version = buffer[offset + 8];
      if (version === 1) {
        if (base + 92 > buffer.length) break;
        return {
          width: buffer.readUInt32BE(base + 84) >>> 16,
          height: buffer.readUInt32BE(base + 88) >>> 16,
        };
      }
      if (base + 80 > buffer.length) break;
      return {
        width: buffer.readUInt32BE(base + 72) >>> 16,
        height: buffer.readUInt32BE(base + 76) >>> 16,
      };
    }
    offset += size;
  }
  return null;
}

function parseResolution(buffer: Buffer): TrackHeader | null {
  let offset = 0;
  const len = buffer.length;
  while (offset + 8 <= len) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);

    if (size === 1) {
      // box de 64 bits: poco común en YouTube, lo saltamos
      if (offset + 16 > len) break;
      const big = Number(buffer.readBigUInt64BE(offset + 8));
      if (big < 16 || big > 0x7fffffff) break;
      offset += big;
      continue;
    }
    if (size < 8 || size === 0 || size > len - offset) break;

    if (type === "moov") {
      const found = findTrackHeader(buffer, offset + 8, offset + size);
      if (found) return found;
    }
    offset += size;
  }
  return null;
}

export interface InspectedFile {
  url: string;
  size: number;
  resolucion: { width: number; height: number };
}

// pide el primer MB (range request) y parsea el moov para ver la resolución real
export async function inspectMp4Url(
  url: string,
  opts: { signal?: AbortSignal; headers?: Record<string, string> } = {}
): Promise<InspectedFile> {
  const response = await fetch(normalizeHttpUrl(url), {
    method: "GET",
    headers: {
      Range: "bytes=0-1048575",
      "User-Agent": ANDROID_UA,
      ...(opts.headers || {}),
    },
    dispatcher,
    redirect: "follow",
    signal: opts.signal,
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`El servidor respondió HTTP ${response.status}.`);
  }

  let size = 0;
  const contentRange = response.headers.get("content-range");
  if (contentRange) {
    const total = contentRange.split("/").pop();
    const parsed = Number(total);
    if (Number.isFinite(parsed) && parsed > 0) size = parsed;
  }
  if (!size) {
    const length = Number(response.headers.get("content-length") || 0);
    if (Number.isFinite(length) && length > 0) size = length;
  }

  // Algunos CDN ignoran Range y empiezan a enviar el MP4 completo. Nunca
  // acumulamos más de 1 MiB durante la inspección: basta para el moov de los
  // archivos fast-start y evita descargar un video grande dos veces antes de
  // que la carrera elija un proveedor.
  const limit = 1024 * 1024;
  const reader = response.body?.getReader();
  const chunks: Buffer[] = [];
  let received = 0;
  try {
    if (reader) {
      while (received < limit) {
        const { done, value } = await reader.read();
        if (done || !value?.byteLength) break;
        const take = Math.min(value.byteLength, limit - received);
        chunks.push(Buffer.from(value.subarray(0, take)));
        received += take;
        if (take < value.byteLength) break;
      }
    }
  } finally {
    await reader?.cancel().catch(() => undefined);
  }

  const buffer = Buffer.concat(chunks, received);
  const resolucion = parseResolution(buffer) ?? { width: 0, height: 0 };

  return { url: normalizeHttpUrl(response.url || url), size, resolucion };
}
