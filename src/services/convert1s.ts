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

export interface AudioResult {
  url: string;
  archivo: string;
  referer: string;
  calidad: string;
}

interface JsonOptions {
  signal?: AbortSignal;
  timeout?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
}

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
      `El servidor respondió con datos inválidos (HTTP ${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      `El servidor no pudo procesar la solicitud (HTTP ${response.status}).`
    );
  }

  return data;
}

function readPercent(result: any): number {
  const percent = Number(
    result.progress ??
      result.percent ??
      result.progressPercent ??
      result.percentage ??
      0
  );
  return Number.isFinite(percent) && percent > 0 && percent < 100
    ? percent
    : 0;
}

async function checkCopyright(
  url: string,
  signal?: AbortSignal
): Promise<void> {
  const copyright = await getJson(
    `https://dmca.ytmp3.gg/api/check?url=${encodeURIComponent(url)}`,
    { signal }
  );
  if (copyright.blocked) {
    throw new Error("El video está bloqueado por derechos de autor.");
  }
}

async function startConversion(
  url: string,
  quality: number,
  type: "video" | "audio",
  signal?: AbortSignal
): Promise<any> {
  const body: any = {
    url,
    os: "windows",
    output: {
      type,
      format: type === "video" ? "mp4" : "mp3",
      quality: type === "video" ? `${quality}p` : String(quality),
    },
  };
  if (type === "video") {
    body.audio = { bitrate: "128k" };
  }
  const conversion = await getJson("https://hub.convert1s.com/api/download", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
    timeout: 120000,
  });

  if (!conversion.statusUrl) {
    throw new Error("No se pudo iniciar la conversión. Inténtalo de nuevo.");
  }
  return conversion;
}

async function waitForConversion(
  statusUrl: string,
  signal: AbortSignal | undefined,
  onProgress?: (percent: number) => void
): Promise<any> {
  for (let attempt = 0; attempt < 120; attempt++) {
    const result = await getJson(statusUrl, { signal });

    if (onProgress) {
      const percent = readPercent(result);
      if (percent > 0) onProgress(percent);
    }

    if (result.status === "completed" && result.downloadUrl) {
      return result;
    }

    if (["error", "failed", "cancelled"].includes(result.status)) {
      throw new Error("La conversión falló. Inténtalo de nuevo.");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new Error("La conversión superó el tiempo máximo.");
}

export async function ytmp4(
  url: string,
  quality: number,
  signal?: AbortSignal,
  exact = false,
  onProgress?: (percent: number) => void
): Promise<VideoResult> {
  await checkCopyright(url, signal);

  const conversion = await startConversion(url, quality, "video", signal);
  const result = await waitForConversion(
    conversion.statusUrl,
    signal,
    onProgress
  );

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
      `El servidor no pudo entregar ${quality}p (entrega ${promisedHeight}p).`
    );
  }
  if (exact && realHeight && realHeight !== Number(quality)) {
    throw new Error(
      `El servidor no pudo entregar ${quality}p (entrega ${realHeight}p).`
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

export async function ytmp3(
  url: string,
  quality: number,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void
): Promise<AudioResult> {
  await checkCopyright(url, signal);

  const conversion = await startConversion(url, quality, "audio", signal);
  const result = await waitForConversion(
    conversion.statusUrl,
    signal,
    onProgress
  );

  return {
    url: result.downloadUrl as string,
    archivo: result.filename || `${result.title || "audio"}.mp3`,
    referer: `${origin}/`,
    calidad: `${quality} kbps`,
  };
}
