import { createDecipheriv } from "node:crypto";
import { fetch } from "undici";
import { dispatcher, withTimeout } from "../utils";

/**
 * Scraper de SaveTube (save-tube.com).
 *
 * Flujo:
 *  1. GET  https://media.savetube.vip/api/random-cdn   → { cdn }
 *  2. POST https://{cdn}/v2/info  { url }              → { status, data } (cifrado AES-128-CBC)
 *  3. Descifrar `data` → { id, key, title, thumbnail, duration, video_formats, audio_formats }
 *  4. POST https://{cdn}/download { downloadType, quality, key } → { data: { downloadUrl } }
 */

const CDN_ENDPOINT = "https://media.savetube.vip/api/random-cdn";
const ORIGIN = "https://save-tube.com";
const AES_KEY = Buffer.from("C5D58EF67A7584E4A29F6C35BBC4EB12", "hex");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface SavetubeFormat {
  quality?: number;
  height?: number;
  label?: string;
  url?: string | null;
  default_selected?: number;
}

export interface SavetubeMeta {
  id: string;
  key: string;
  title: string;
  thumbnail?: string | null;
  duration?: number;
  durationLabel?: string;
  video_formats?: SavetubeFormat[];
  audio_formats?: SavetubeFormat[];
}

export interface VideoResult {
  url: string;
  referer: string;
  calidad: string;
  tamaño: number;
  archivo: string | null;
  titulo: string | null;
  canal: string | null;
  duracion: number;
  miniatura: string | null;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "User-Agent": UA,
    Origin: ORIGIN,
    Referer: `${ORIGIN}/`,
    ...extra,
  };
}

/** Pide un CDN de descarga activo al balanceador de SaveTube. */
async function randomCdn(signal?: AbortSignal): Promise<string> {
  const response = await fetch(CDN_ENDPOINT, {
    headers: headers(),
    dispatcher,
    redirect: "follow",
    signal: withTimeout(signal, 10000),
  });
  if (!response.ok) {
    throw new Error(`SaveTube respondió HTTP ${response.status}.`);
  }
  const data: any = await response.json();
  if (!data?.cdn) {
    throw new Error("SaveTube no pudo asignar un servidor de descarga.");
  }
  return data.cdn as string;
}

/** Descifra la respuesta de /v2/info (AES-128-CBC, IV = primeros 16 bytes). */
function decryptInfo(payload: string): SavetubeMeta {
  const raw = Buffer.from(payload, "base64");
  if (raw.length <= 16) {
    throw new Error("SaveTube devolvió datos de video inválidos.");
  }
  const iv = raw.subarray(0, 16);
  const ciphertext = raw.subarray(16);
  const decipher = createDecipheriv("aes-128-cbc", AES_KEY, iv);
  const plain = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plain) as SavetubeMeta;
}

/** Obtiene y descifra la información del video. */
async function getMeta(
  url: string,
  signal?: AbortSignal
): Promise<SavetubeMeta> {
  const cdn = await randomCdn(signal);
  const response = await fetch(`https://${cdn}/v2/info`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ url }),
    dispatcher,
    redirect: "follow",
    signal: withTimeout(signal, 20000),
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok || !data?.status || !data?.data) {
    throw new Error(
      (response.status === 429
        ? "Demasiadas peticiones a SaveTube. Inténtalo en unos segundos."
        : "SaveTube no pudo procesar el video.") +
        (response.ok ? "" : ` (HTTP ${response.status})`)
    );
  }
  return decryptInfo(data.data);
}

/** Genera el enlace directo de descarga para un formato concreto. */
async function getDownloadLink(
  cdn: string,
  meta: SavetubeMeta,
  downloadType: "video" | "audio",
  quality: string,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(`https://${cdn}/download`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      downloadType,
      quality,
      key: meta.key,
    }),
    dispatcher,
    redirect: "follow",
    signal: withTimeout(signal, 20000),
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok || !data?.status || !data?.data?.downloadUrl) {
    throw new Error(
      data?.message && data.message !== "200"
        ? `SaveTube no generó el enlace: ${data.message}.`
        : "SaveTube no generó el enlace de descarga."
    );
  }
  return data.data.downloadUrl as string;
}

/** Elige el formato más cercano a la calidad pedida (exacta, o la mejor inferior). */
function pickFormat(
  formats: SavetubeFormat[],
  requested: number
): SavetubeFormat | null {
  if (!formats?.length) return null;
  const value = (f: SavetubeFormat) => f.quality || f.height || 0;
  const exact = formats.find((f) => value(f) === requested);
  if (exact) return exact;
  const lower = formats.filter((f) => value(f) < requested);
  if (lower.length) {
    return lower.sort((a, b) => value(b) - value(a))[0];
  }
  return formats.sort((a, b) => value(a) - value(b))[0];
}

/** Descarga un video MP4 (SaveTube). */
export async function ytmp4(
  url: string,
  quality: number,
  signal?: AbortSignal
): Promise<VideoResult> {
  const meta = await getMeta(url, signal);
  const format = pickFormat(meta.video_formats || [], quality);
  if (!format) {
    throw new Error("Este video no ofrece formato MP4.");
  }
  const actual = format.quality || format.height || quality;
  const cdn = await randomCdn(signal);
  const link = await getDownloadLink(cdn, meta, "video", String(actual), signal);

  return {
    url: link,
    referer: `${ORIGIN}/`,
    calidad: `${actual}p`,
    tamaño: 0,
    archivo: meta.title ? `${meta.title}.mp4` : null,
    titulo: meta.title || null,
    canal: null,
    duracion: Number(meta.duration || 0),
    miniatura: meta.thumbnail || null,
  };
}

/** Descarga un audio MP3 (SaveTube, 128kbps). */
export async function ytmp3(
  url: string,
  signal?: AbortSignal
): Promise<{ url: string; archivo: string; referer: string }> {
  const meta = await getMeta(url, signal);
  const format = meta.audio_formats?.[0];
  if (!format) {
    throw new Error("Este video no ofrece formato MP3.");
  }
  const cdn = await randomCdn(signal);
  const link = await getDownloadLink(
    cdn,
    meta,
    "audio",
    String(format.quality || 128),
    signal
  );

  return {
    url: link,
    archivo: `${meta.title || "audio"}.mp3`,
    referer: `${ORIGIN}/`,
  };
}
