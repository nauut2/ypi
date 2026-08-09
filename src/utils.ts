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
  const response = await fetch(url, {
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

  const buffer = Buffer.from(await response.arrayBuffer());
  const resolucion = parseResolution(buffer) ?? { width: 0, height: 0 };

  return { url: response.url, size, resolucion };
}
