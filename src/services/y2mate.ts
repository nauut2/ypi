import { fetch } from "undici";
import {
  dispatcher,
  inspectMp4Url,
  normalizeHttpUrl,
  probeMediaUrl,
  withTimeout,
} from "../utils";

/**
 * Adaptador del scraper Y2Mate/Y2Meta compartido para cnv.cx.
 * El servicio requiere una llave efímera por video y un Origin concreto tanto
 * al convertir como al recuperar el archivo final.
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const ORIGIN = "https://frame.y2meta-uk.com";
const BASE = "https://cnv.cx/v2";

const mediaHeaders = {
  Origin: ORIGIN,
  Referer: `${ORIGIN}/`,
  "User-Agent": UA,
};

interface KeyResponse {
  key?: unknown;
  error?: unknown;
  errorMsg?: unknown;
}

interface ConversionResponse {
  url?: unknown;
  filename?: unknown;
  error?: unknown;
  errorMsg?: unknown;
}

interface RawConversion {
  url: string;
  filename: string | null;
}

export interface Y2MateAudioResult {
  url: string;
  archivo: string;
  referer: string;
  headers: Record<string, string>;
  calidad: string;
}

export interface Y2MateVideoResult {
  url: string;
  referer: string;
  headers: Record<string, string>;
  calidad: string;
  titulo: string | null;
  duracion: number;
}

function errorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  for (const key of ["errorMsg", "error", "message"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function asFilename(value: unknown, fallback: string): string {
  const filename = typeof value === "string" ? value.trim() : "";
  return filename || fallback;
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !data) {
    throw new Error(
      data ? errorMessage(data, `${fallback} (HTTP ${response.status}).`) : `${fallback} (HTTP ${response.status}).`
    );
  }
  return data;
}

async function getKey(videoId: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(
    `${BASE}/sanity/key?id=${encodeURIComponent(videoId)}`,
    {
      headers: {
        "User-Agent": UA,
        Origin: ORIGIN,
        Referer: `${ORIGIN}/`,
        Accept: "application/json, text/plain, */*",
      },
      dispatcher,
      redirect: "follow",
      signal: withTimeout(signal, 30000),
    }
  );
  const data = await readJson<KeyResponse>(
    response,
    "No se pudo obtener una llave de conversión."
  );
  const key = typeof data.key === "string" ? data.key.trim() : "";
  if (!key) {
    throw new Error(errorMessage(data, "El conversor no devolvió una llave válida."));
  }
  return key;
}

async function convert(
  videoId: string,
  format: "mp3" | "mp4",
  quality: number,
  signal?: AbortSignal
): Promise<RawConversion> {
  const key = await getKey(videoId, signal);
  const body = new URLSearchParams({
    link: `https://youtu.be/${videoId}`,
    format,
    filenameStyle: "pretty",
    vCodec: "h264",
    audioBitrate: format === "mp3" ? String(quality) : "128",
    videoQuality: format === "mp3" ? "720" : String(quality),
  });

  const response = await fetch(`${BASE}/converter`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "*/*",
      key,
      Origin: ORIGIN,
      Referer: `${ORIGIN}/`,
    },
    body: body.toString(),
    dispatcher,
    redirect: "follow",
    signal: withTimeout(signal, 120000),
  });
  const data = await readJson<ConversionResponse>(
    response,
    "La conversión no respondió correctamente."
  );

  if (typeof data.url !== "string" || !data.url.trim()) {
    throw new Error(
      errorMessage(data, "La conversión no devolvió un enlace de descarga.")
    );
  }

  return {
    url: normalizeHttpUrl(data.url),
    filename: typeof data.filename === "string" ? data.filename.trim() || null : null,
  };
}

export async function ytmp3(
  videoId: string,
  quality: number,
  signal?: AbortSignal
): Promise<Y2MateAudioResult> {
  if (![96, 128, 256, 320].includes(quality)) {
    throw new Error("Este conversor solo admite 96, 128, 256 y 320 kbps.");
  }

  const result = await convert(videoId, "mp3", quality, signal);
  const url = await probeMediaUrl(result.url, {
    signal,
    headers: mediaHeaders,
    timeout: 45000,
  });

  return {
    url,
    archivo: asFilename(result.filename, `${videoId}.mp3`),
    referer: `${ORIGIN}/`,
    headers: mediaHeaders,
    calidad: `${quality} kbps`,
  };
}

export async function ytmp4(
  videoId: string,
  quality: number,
  signal?: AbortSignal
): Promise<Y2MateVideoResult> {
  if (![360, 480, 720, 1080].includes(quality)) {
    throw new Error("Este conversor solo admite 360p, 480p, 720p y 1080p.");
  }

  const result = await convert(videoId, "mp4", quality, signal);
  // La inspección hace una petición Range y evita etiquetar silenciosamente
  // como 720p/1080p una respuesta de menor resolución.
  const file = await inspectMp4Url(result.url, {
    signal: withTimeout(signal, 60000),
    headers: mediaHeaders,
  });
  if (file.resolucion.height && file.resolucion.height !== quality) {
    throw new Error(
      `El conversor entregó ${file.resolucion.height}p en lugar de ${quality}p.`
    );
  }

  return {
    url: file.url,
    referer: `${ORIGIN}/`,
    headers: mediaHeaders,
    calidad: `${file.resolucion.height || quality}p`,
    titulo: null,
    duracion: 0,
  };
}
