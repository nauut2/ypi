import { fetch } from "undici";
import { dispatcher, inspectMp4Url, withTimeout } from "../utils";

const origin = "https://media.ytmp3.gg";

export interface VideoResult {
  url: string;
  referer: string;
  calidad: string;
  tamaño: number;
  archivo: string | null;
  titulo: string | null;
  duracion: number;
}

interface JsonOptions {
  signal?: AbortSignal;
  timeout?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
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

/** Petición JSON con cabeceras de origen y timeout. */
async function getJson(
  url: string,
  { signal, timeout = 30000, headers, method, body }: JsonOptions = {}
): Promise<any> {
  const response = await fetch(url, {
    method: method || "GET",
    body,
    headers: {
      Accept: "application/json",
      Origin: origin,
      Referer: `${origin}/`,
      "User-Agent": "Mozilla/5.0",
      ...(headers || {}),
    },
    dispatcher,
    redirect: "follow",
    signal: withTimeout(signal, timeout),
  });

  const text = await response.text();
  let data: any;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(
      `Convert1s respondió HTTP ${response.status} con datos inválidos.`
    );
  }

  if (!response.ok) {
    throw new Error(
      toMessage(
        data.message || data.error,
        `Convert1s respondió HTTP ${response.status}.`
      )
    );
  }

  return data;
}

/**
 * Descarga un video MP4 (360p/720p/1080p) vía el conversor de Convert1s.
 * Hace una comprobación DMCA, inicia la conversión y sondea el estado
 * hasta que el archivo esté listo.
 */
export async function ytmp4(
  url: string,
  quality: number,
  signal?: AbortSignal,
  exact = false
): Promise<VideoResult> {
  const copyright = await getJson(
    `https://dmca.ytmp3.gg/api/check?url=${encodeURIComponent(url)}`,
    { signal }
  );
  if (copyright.blocked) {
    throw new Error(
      toMessage(copyright.message, "El video está bloqueado por derechos de autor.")
    );
  }

  const conversion = await getJson("https://hub.convert1s.com/api/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      os: "windows",
      output: {
        type: "video",
        format: "mp4",
        quality: `${quality}p`,
      },
      audio: { bitrate: "128k" },
    }),
    signal,
    timeout: 120000,
  });

  if (!conversion.statusUrl) {
    throw new Error(
      toMessage(conversion.message, "No se pudo iniciar la conversión.")
    );
  }

  for (let attempt = 0; attempt < 120; attempt++) {
    const result = await getJson(conversion.statusUrl, { signal });

    if (result.status === "completed" && result.downloadUrl) {
      const file = await inspectMp4Url(result.downloadUrl, {
        signal,
        headers: {
          Origin: origin,
          Referer: `${origin}/`,
        },
      });

      const promised = String(
        result.selectedQuality || conversion.selectedQuality || ""
      );
      const promisedHeight = Number(promised.match(/(\d{3,4})/)?.[1] || 0);
      const realHeight = file.resolucion?.height || 0;

      if (exact && promisedHeight && promisedHeight !== Number(quality)) {
        throw new Error(
          `Convert1s no pudo entregar ${quality}p (entrega ${promisedHeight}p).`
        );
      }
      if (exact && realHeight && realHeight !== Number(quality)) {
        throw new Error(
          `Convert1s no pudo entregar ${quality}p (entrega ${realHeight}p).`
        );
      }

      return {
        url: file.url,
        referer: `${origin}/`,
        calidad: promised || `${quality}p`,
        tamaño: Number(
          result.filesize ||
            result.fileSize ||
            result.file_size ||
            result.size ||
            conversion.filesize ||
            conversion.fileSize ||
            conversion.file_size ||
            conversion.size ||
            file.size ||
            0
        ),
        archivo: result.filename || conversion.filename || null,
        titulo: result.title || conversion.title || null,
        duracion: Number(result.duration || conversion.duration || 0),
      };
    }

    if (["error", "failed", "cancelled"].includes(result.status)) {
      throw new Error(toMessage(result.message, "La conversión falló."));
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("La conversión superó el tiempo máximo.");
}
