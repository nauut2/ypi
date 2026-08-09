import { fetch } from "undici";
import { ANDROID_UA, dispatcher, inspectMp4Url, withTimeout } from "../utils";

const PLAYER_URL =
  "https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false";

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

function toMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  return fallback;
}

// solo entrega 360p con audio; si pides otra calidad, pierde la carrera
export async function ytmp4(
  videoId: string,
  quality: number,
  signal?: AbortSignal
): Promise<VideoResult> {
  if (quality !== 360) {
    throw new Error("Este servidor solo entrega 360p.");
  }

  const response = await fetch(PLAYER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": ANDROID_UA,
      "X-YouTube-Client-Name": "3",
      "X-YouTube-Client-Version": "20.10.38",
    },
    body: JSON.stringify({
      videoId,
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38",
          androidSdkVersion: 34,
          hl: "es",
          gl: "US",
        },
      },
    }),
    dispatcher,
    signal: withTimeout(signal, 30000),
  });

  if (!response.ok) {
    throw new Error(`El servidor respondió HTTP ${response.status}.`);
  }

  const player: any = await response.json();

  if (player.playabilityStatus?.status !== "OK") {
    throw new Error(
      toMessage(player.playabilityStatus?.reason, "El video no está disponible.")
    );
  }

  const format = (player.streamingData?.formats || []).find(
    (item: any) => item.itag === 18 || item.qualityLabel === "360p"
  );

  if (!format?.url) {
    throw new Error("El video no ofrece MP4 360p con audio.");
  }

  // confirmamos la resolución real del archivo
  const file = await inspectMp4Url(format.url, { signal });
  if (file.resolucion.height && file.resolucion.height !== 360) {
    throw new Error(
      `El servidor entregó ${file.resolucion.height}p en lugar de 360p.`
    );
  }

  const details = player.videoDetails || {};
  const thumbnails = details.thumbnail?.thumbnails || [];

  return {
    url: file.url,
    referer: "",
    calidad: "360p",
    tamaño: Number(format.contentLength || file.size || 0),
    archivo: details.title ? `${details.title}.mp4` : null,
    titulo: details.title || null,
    canal: details.author || null,
    duracion: Number(details.lengthSeconds || 0),
    miniatura: thumbnails.at(-1)?.url || null,
  };
}
