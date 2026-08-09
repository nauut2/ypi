import { createDecipheriv } from "node:crypto";
import { fetch } from "undici";
import { dispatcher, inspectMp4Url, withTimeout } from "../utils";

const CDN_ENDPOINT = "https://media.savetube.vip/api/random-cdn";
const ORIGIN = "https://save-tube.com";
// clave de cifrado que usa la propia web para la info del video
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

// la respuesta de /v2/info viene cifrada (AES-CBC); el IV son los primeros 16 bytes
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

export async function ytmp4(
  url: string,
  quality: number,
  signal?: AbortSignal
): Promise<VideoResult> {
  const meta = await getMeta(url, signal);
  const format = (meta.video_formats || []).find(
    (f) => (f.quality || f.height) === quality
  );
  if (!format) {
    throw new Error(`Este video no ofrece la calidad ${quality}p exacta.`);
  }

  const cdn = await randomCdn(signal);
  const link = await getDownloadLink(cdn, meta, "video", String(quality), signal);

  // confirmamos la resolución real del archivo antes de entregarlo
  const file = await inspectMp4Url(link, {
    signal,
    headers: { Origin: ORIGIN, Referer: `${ORIGIN}/` },
  });
  if (file.resolucion.height && file.resolucion.height !== quality) {
    throw new Error(
      `El servidor entregó ${file.resolucion.height}p en lugar de ${quality}p.`
    );
  }

  return {
    url: file.url,
    referer: `${ORIGIN}/`,
    calidad: `${quality}p`,
    tamaño: 0,
    archivo: meta.title ? `${meta.title}.mp4` : null,
    titulo: meta.title || null,
    canal: null,
    duracion: Number(meta.duration || 0),
    miniatura: meta.thumbnail || null,
  };
}

export async function ytmp3(
  url: string,
  signal?: AbortSignal
): Promise<{ url: string; archivo: string; referer: string; calidad: string }> {
  const meta = await getMeta(url, signal);
  const format = meta.audio_formats?.[0];
  if (!format) {
    throw new Error("Este video no ofrece formato MP3.");
  }
  const actual = format.quality || 128;
  const cdn = await randomCdn(signal);
  const link = await getDownloadLink(
    cdn,
    meta,
    "audio",
    String(actual),
    signal
  );

  return {
    url: link,
    archivo: `${meta.title || "audio"}.mp3`,
    referer: `${ORIGIN}/`,
    calidad: `${actual} kbps`,
  };
}
