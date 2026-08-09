import axios from "axios";
import { DESKTOP_UA } from "../utils";

const BASE = "https://yt2song.com/api/v1";
const ORIGIN = "https://yt2song.com";

export interface AudioResult {
  archivo: string;
  referer: string;
  calidad: string;
  stream: NodeJS.ReadableStream;
}

// el audio llega como stream binario en la propia respuesta del POST
export async function ytmp3(
  url: string,
  quality: number,
  signal?: AbortSignal
): Promise<AudioResult> {
  const headers = {
    "User-Agent": DESKTOP_UA,
    Origin: ORIGIN,
    Referer: `${ORIGIN}/`,
  };

  const info = await axios
    .post(`${BASE}/infos`, { url }, { headers, signal, timeout: 20000 })
    .catch(() => null);

  const title = typeof info?.data?.title === "string" ? info.data.title : null;

  const response = await axios.post(
    `${BASE}/download`,
    {
      url,
      format: "mp3",
      bitrate: String(quality),
    },
    {
      headers,
      signal,
      responseType: "stream",
      timeout: 180000,
      validateStatus: () => true,
    }
  );

  const type = String(response.headers?.["content-type"] || "");
  if (response.status !== 200 || !response.data || type.includes("json")) {
    let message = "No se pudo generar el enlace del audio.";
    if (response.data && type.includes("json")) {
      try {
        const chunks: Buffer[] = [];
        for await (const chunk of response.data as AsyncIterable<Buffer>) {
          chunks.push(chunk);
        }
        const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        message = parsed?.message || parsed?.error || message;
      } catch {
        /* sin mensaje extra */
      }
    }
    throw new Error(message);
  }

  return {
    archivo: `${title || "audio"}.mp3`,
    referer: `${ORIGIN}/`,
    calidad: `${quality} kbps`,
    stream: response.data as NodeJS.ReadableStream,
  };
}
