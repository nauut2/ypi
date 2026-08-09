import { fetch } from "undici";
import { DESKTOP_UA, dispatcher, withTimeout } from "../utils";

export interface VideoDetails {
  titulo: string | null;
  canal: string | null;
  miniatura: string | null;
}

const EMPTY: VideoDetails = { titulo: null, canal: null, miniatura: null };

// nunca lanza: si oEmbed falla, seguimos sin detalles
export async function fetchVideoDetails(
  videoId: string
): Promise<VideoDetails> {
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${videoId}`
    )}&format=json`;

    const response = await fetch(url, {
      headers: { "User-Agent": DESKTOP_UA },
      dispatcher,
      redirect: "follow",
      signal: withTimeout(undefined, 8000),
    });

    if (!response.ok) return EMPTY;

    const data: any = await response.json();

    // subimos la miniatura a maxresdefault; el frontend cae a hqdefault si no existe
    const thumb: string | null =
      typeof data.thumbnail_url === "string"
        ? data.thumbnail_url.replace(/hqdefault\.jpg$/, "maxresdefault.jpg")
        : null;

    return {
      titulo: typeof data.title === "string" ? data.title : null,
      canal:
        typeof data.author_name === "string" ? data.author_name : null,
      miniatura: thumb,
    };
  } catch {
    return EMPTY;
  }
}
