import { fetch } from "undici";
import {
  dispatcher,
  inspectMp4Url,
  normalizeHttpUrl,
  probeMediaUrl,
  withTimeout,
} from "../utils";

/**
 * Adaptador directo para cnvmp3.com.
 *
 * La versión anterior intentaba pasar el enlace final por un proxy externo.
 * Eso hacía que una conversión válida fallara después de ganar la carrera.
 * Ahora normalizamos y comprobamos el enlace que entrega el propio proveedor.
 */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const BASE = "https://cnvmp3.com";
const REFERER = `${BASE}/v55`;
const AUDIO_QUALITY_CODE = { 320: 0, 256: 1, 128: 4, 96: 5 } as const;

export type AudioQuality = keyof typeof AUDIO_QUALITY_CODE;

const mediaHeaders = {
  Referer: REFERER,
  "User-Agent": UA,
};

interface VideoDataResponse {
  success?: unknown;
  title?: unknown;
  error?: unknown;
  message?: unknown;
}

interface DownloadResponse {
  success?: unknown;
  download_link?: unknown;
  error?: unknown;
  message?: unknown;
}

export interface AudioResult {
  url: string;
  archivo: string;
  referer: string;
  headers: Record<string, string>;
  calidad: string;
}

export interface VideoResult {
  url: string;
  referer: string;
  headers: Record<string, string>;
  calidad: string;
  titulo: string | null;
  duracion: number;
}

function message(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const value = data as Record<string, unknown>;
  for (const key of ["error", "message"]) {
    const content = value[key];
    if (typeof content === "string" && content.trim()) return content.trim();
  }
  return fallback;
}

async function postJson<T>(
  endpoint: string,
  payload: unknown,
  signal?: AbortSignal,
  timeout = 60000
): Promise<T> {
  const response = await fetch(`${BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/json",
      Referer: REFERER,
      Accept: "application/json, text/plain, */*",
    },
    body: JSON.stringify(payload),
    dispatcher,
    redirect: "follow",
    signal: withTimeout(signal, timeout),
  });

  const data = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !data) {
    throw new Error(`El servidor respondió HTTP ${response.status}.`);
  }
  return data;
}

async function getTitle(videoId: string, signal?: AbortSignal): Promise<string> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await postJson<VideoDataResponse>(
    "get_video_data.php",
    { url: watchUrl, token: "1234" },
    signal,
    45000
  );

  const title = typeof response.title === "string" ? response.title.trim() : "";
  if (!title) {
    throw new Error(message(response, "No se pudo obtener el título del video."));
  }
  return title;
}

async function getDownloadUrl(
  videoId: string,
  format: "mp3" | "mp4",
  quality: number,
  signal?: AbortSignal
): Promise<{ url: string; title: string }> {
  const title = await getTitle(videoId, signal);
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await postJson<DownloadResponse>(
    "download_video_ucep.php",
    {
      url: watchUrl,
      quality,
      title,
      formatValue: format === "mp3" ? 1 : 0,
    },
    signal,
    150000
  );

  if (typeof response.download_link !== "string" || !response.download_link.trim()) {
    throw new Error(
      message(response, "La conversión no devolvió un enlace de descarga.")
    );
  }

  return { url: normalizeHttpUrl(response.download_link), title };
}

export async function ytmp3(
  videoId: string,
  quality: AudioQuality,
  signal?: AbortSignal
): Promise<AudioResult> {
  if (!(quality in AUDIO_QUALITY_CODE)) {
    throw new Error("Este conversor solo admite 96, 128, 256 y 320 kbps.");
  }

  const requestedQuality = Number(quality);
  const conversion = await getDownloadUrl(
    videoId,
    "mp3",
    AUDIO_QUALITY_CODE[quality],
    signal
  );
  const url = await probeMediaUrl(conversion.url, {
    signal,
    headers: mediaHeaders,
    timeout: 45000,
  });

  return {
    url,
    archivo: `${conversion.title}.mp3`,
    referer: REFERER,
    headers: mediaHeaders,
    calidad: `${requestedQuality} kbps`,
  };
}

export async function ytmp4(
  videoId: string,
  quality: number,
  signal?: AbortSignal
): Promise<VideoResult> {
  if (![360, 480, 720, 1080].includes(quality)) {
    throw new Error("Este conversor solo admite 360p, 480p, 720p y 1080p.");
  }

  const conversion = await getDownloadUrl(videoId, "mp4", quality, signal);
  const file = await inspectMp4Url(conversion.url, {
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
    referer: REFERER,
    headers: mediaHeaders,
    calidad: `${file.resolucion.height || quality}p`,
    titulo: conversion.title,
    duracion: 0,
  };
}
