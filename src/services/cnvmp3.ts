import axios from "axios";
import { DESKTOP_UA } from "../utils";

const qualities: Record<number, number> = { 320: 0, 256: 1, 128: 4, 96: 5 };

export type AudioQuality = keyof typeof qualities;

function proxyUrl(value: string): string {
  return `https://cnv.niju.eu/${encodeURIComponent(value)}`;
}

const client = axios.create({
  baseURL: "https://cnvmp3.com",
  timeout: 60000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "es-ES,es;q=0.9",
    "Content-Type": "application/json",
    Origin: "https://cnvmp3.com",
    Referer: "https://cnvmp3.com/v55",
    "User-Agent": DESKTOP_UA,
  },
});

interface CnvResponse {
  success?: boolean;
  data?: { server_path?: string; title?: string };
  error?: string;
  errorType?: number;
  download_link?: string;
  title?: string;
}

async function request(
  path: string,
  data: unknown,
  signal?: AbortSignal
): Promise<CnvResponse> {
  return (await client.post(path, data, { signal })).data;
}

/** Convierte un valor (string, objeto, etc.) en un mensaje legible. */
function toMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const obj = value as { message?: unknown; error?: unknown };
    const inner = toMessage(obj.message, toMessage(obj.error, ""));
    if (inner) return inner;
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

async function validate(url: string, signal?: AbortSignal): Promise<void> {
  const response = await axios.get(url, {
    responseType: "stream",
    timeout: 60000,
    signal,
    headers: {
      Accept: "audio/mpeg,audio/*;q=0.9,*/*;q=0.8",
      Range: "bytes=0-1048575",
      Referer: "https://cnvmp3.com/",
      "User-Agent": DESKTOP_UA,
    },
    validateStatus: (status) => status === 200 || status === 206,
  });

  response.data.destroy();
}

async function fromCache(
  videoId: string,
  quality: AudioQuality,
  signal?: AbortSignal
) {
  const result = await request(
    "/check_database.php",
    {
      youtube_id: videoId,
      quality: qualities[quality],
      formatValue: 1,
    },
    signal
  );

  if (!result.success || !result.data?.server_path) {
    throw new Error("El audio no está en caché.");
  }

  await validate(result.data.server_path, signal);

  return {
    url: proxyUrl(result.data.server_path),
    archivo: `${result.data.title || videoId}.mp3`,
    referer: "https://cnvmp3.com/",
  };
}

async function convert(
  videoId: string,
  quality: AudioQuality,
  signal?: AbortSignal
) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const info = await request(
    "/get_video_data.php",
    { url, token: "1234" },
    signal
  );

  if (info.error) {
    throw new Error(
      toMessage(info.error, "El servidor no pudo obtener la información del video.")
    );
  }

  const title = info.title || videoId;

  const result = await request(
    "/download_video_ucep.php",
    {
      url,
      quality: qualities[quality],
      title,
      formatValue: 1,
    },
    signal
  );

  if (result.error) {
    throw new Error(
      result.errorType === 4
        ? "El video es demasiado largo."
        : toMessage(result.error, "La conversión del audio falló.")
    );
  }
  if (!result.download_link) {
    throw new Error("CnvMP3 no devolvió la URL del audio.");
  }

  await validate(result.download_link, signal);

  return {
    url: proxyUrl(result.download_link),
    archivo: `${title}.mp3`,
    referer: "https://cnvmp3.com/",
  };
}

export interface AudioResult {
  url: string;
  archivo: string;
  referer: string;
}

export async function ytmp3(
  videoId: string,
  quality: AudioQuality,
  signal?: AbortSignal
): Promise<AudioResult> {
  if (!(quality in qualities)) {
    throw new Error("Este servidor solo admite 96, 128, 256 y 320kbps.");
  }

  try {
    return await Promise.any([
      fromCache(videoId, quality, signal),
      convert(videoId, quality, signal),
    ]);
  } catch (error: any) {
    throw new Error(
      error.errors?.map((item: any) => item.message).filter(Boolean).join(" | ") ||
        error.message
    );
  }
}
