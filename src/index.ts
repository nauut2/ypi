import axios from "axios";
import express from "express";
import path from "node:path";
import {
  createFileStream,
  getTTLSeconds,
  cleanupOldFiles,
  resolveFile,
  saveAudioBuffer,
  saveVideoBuffer,
} from "./storage";
import {
  ytmp3 as cnvmp3Audio,
  ytmp4 as cnvmp3Video,
  AudioQuality,
} from "./services/cnvmp3";
import {
  ytmp3 as y2mateAudio,
  ytmp4 as y2mateVideo,
} from "./services/y2mate";
import { ytmp4 as androidVideo } from "./services/android";
import { ytmp3 as yt2songAudio } from "./services/yt2song";
import { fetchVideoDetails } from "./services/oembed";
import {
  ytmp4 as savetubeVideo,
  ytmp3 as savetubeAudio,
} from "./services/savetube";
import { getStats, recordDownload } from "./stats";
import { DESKTOP_UA, extractVideoId, sanitizeFilename } from "./utils";

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

app.use(express.json({ limit: "100kb" }));

const CONCURRENT_MAX = 4;
const PER_IP_LIMIT = 5;
const PER_IP_WINDOW = 60_000;
let activeDownloads = 0;
const hits = new Map<string, number[]>();

// mensajes según el idioma que pide el cliente (es/en)
const T = {
  es: {
    rateLimited: "Demasiadas peticiones. Espera un momento.",
    busy: "Hay muchas descargas en curso. Inténtalo en unos segundos.",
    invalidUrl: "El enlace de YouTube no es válido.",
    invalidVideoQuality: "Calidad de video no válida (360, 480, 720 o 1080).",
    invalidAudioQuality: "Calidad de audio no válida.",
    stageSearch: "Buscando en varios servidores…",
    stageDetails: "Obteniendo detalles del video…",
    stageDownloadVideo: "Descargando el archivo MP4…",
    stageDownloadAudio: "Descargando el archivo MP3…",
    videoError: "Error al descargar el video.",
    audioError: "Error al descargar el audio.",
    raceFail: "No se pudo completar la descarga. Inténtalo en unos segundos.",
    notFound: "Archivo no encontrado o expirado.",
  },
  en: {
    rateLimited: "Too many requests. Please wait a moment.",
    busy: "Too many downloads in progress. Try again in a few seconds.",
    invalidUrl: "The YouTube link is not valid.",
    invalidVideoQuality: "Invalid video quality (360, 480, 720 or 1080).",
    invalidAudioQuality: "Invalid audio quality.",
    stageSearch: "Searching on several servers…",
    stageDetails: "Getting video details…",
    stageDownloadVideo: "Downloading the MP4 file…",
    stageDownloadAudio: "Downloading the MP3 file…",
    videoError: "Error downloading the video.",
    audioError: "Error downloading the audio.",
    raceFail: "Could not complete the download. Try again in a few seconds.",
    notFound: "File not found or expired.",
  },
} as const;

function t(lang: string, key: keyof typeof T.es): string {
  const dict = lang === "en" ? T.en : T.es;
  return dict[key];
}

// acepta "en", "en-US", "es-ES", etc.
function pickLang(value: unknown): string {
  return String(value || "").toLowerCase().startsWith("en") ? "en" : "es";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < PER_IP_WINDOW);
  if (recent.length >= PER_IP_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function beginDownload(ip: string, lang: string): string | null {
  if (rateLimited(ip)) return t(lang, "rateLimited");
  if (activeDownloads >= CONCURRENT_MAX) {
    return t(lang, "busy");
  }
  activeDownloads++;
  return null;
}

function endDownload(): void {
  activeDownloads = Math.max(0, activeDownloads - 1);
}

// el cliente lee el progreso real por un stream de eventos
type EmitFn = (event: Record<string, unknown>) => void;

function sseStart(req: express.Request, res: express.Response): boolean {
  const wantsSse = (req.headers.accept || "").includes("text/event-stream");
  if (wantsSse) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
  }
  return wantsSse;
}

function sseWrite(res: express.Response, event: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function makeProgress(emit: EmitFn) {
  let lastPct = -1;
  let lastTime = 0;
  return (written: number, total: number) => {
    const pct = total > 0 ? Math.floor((written / total) * 100) : -1;
    const now = Date.now();
    if (pct === lastPct || now - lastTime < 200) return;
    lastPct = pct;
    lastTime = now;
    emit({ type: "progress", stage: "download", percent: pct });
  };
}

interface VideoInfo {
  url: string;
  referer: string;
  /** Cabeceras necesarias para recuperar URLs firmadas de algunos proveedores. */
  headers?: Record<string, string>;
  calidad: string;
  titulo: string | null;
  duracion: number;
}

interface AudioInfo {
  url?: string;
  archivo: string;
  referer: string;
  /** Cabeceras necesarias para recuperar URLs firmadas de algunos proveedores. */
  headers?: Record<string, string>;
  calidad?: string;
  stream?: NodeJS.ReadableStream;
}

// corre todos los scraper a la vez; el primero en responder gana y
// el resto se aborta para no gastar recursos
async function raceScrapers<T>(
  builders: Array<(signal: AbortSignal) => Promise<T>>,
  lang: string
): Promise<T> {
  const controllers = builders.map(() => new AbortController());
  try {
    const tagged = builders.map((build, index) =>
      build(controllers[index].signal).then((value) => ({ value, index }))
    );
    const winner = await Promise.any(tagged);
    // abortamos solo a los perdedores; el ganador conserva su señal
    controllers.forEach((controller, index) => {
      if (index !== winner.index) controller.abort();
    });
    return winner.value;
  } catch {
    controllers.forEach((controller) => controller.abort());
    throw new Error(t(lang, "raceFail"));
  }
}

async function fetchVideo(
  fullUrl: string,
  quality: number,
  emit: EmitFn,
  lang: string
): Promise<VideoInfo> {
  const videoId = extractVideoId(fullUrl) || "";
  emit({ type: "stage", label: t(lang, "stageSearch") });
  return await raceScrapers<VideoInfo>(
    [
      // Y2Mate/cnv.cx y cnvmp3 devuelven enlaces firmados que se validan
      // antes de entrar a la carrera; así no bloquean una descarga con un 200 HTML.
      (signal) => y2mateVideo(videoId, quality, signal),
      (signal) => cnvmp3Video(videoId, quality, signal),
      (signal) => savetubeVideo(fullUrl, quality, signal),
      (signal) => androidVideo(videoId, quality, signal),
    ],
    lang
  );
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, servicio: "ypi", tiempo: Math.round(process.uptime()) });
});

// cuántos archivos se han descargado (persistido en SQLite)
app.get("/api/stats", (_req, res) => {
  res.json({ ok: true, data: getStats() });
});

app.post("/api/video", async (req, res) => {
  const lang = pickLang(req.body?.lang);
  const limitError = beginDownload(req.ip || "unknown", lang);
  const videoId = extractVideoId(String(req.body?.url || ""));
  const quality = Number(req.body?.quality || 360);

  if (limitError) {
    res.status(429).json({ ok: false, error: limitError });
    return;
  }
  if (!videoId) {
    endDownload();
    res.status(400).json({ ok: false, error: t(lang, "invalidUrl") });
    return;
  }
  if (![360, 480, 720, 1080].includes(quality)) {
    endDownload();
    res.status(400).json({ ok: false, error: t(lang, "invalidVideoQuality") });
    return;
  }

  const sse = sseStart(req, res);
  const emit: EmitFn = (event) => {
    if (sse) sseWrite(res, event);
  };

  try {
    emit({ type: "stage", label: t(lang, "stageDetails") });
    const info = await fetchVideo(
      `https://www.youtube.com/watch?v=${videoId}`,
      quality,
      emit,
      lang
    );
    const details = await fetchVideoDetails(videoId);

    const name = sanitizeFilename(
      (info.titulo || details.titulo || "video").replace(/\.mp4$/i, "")
    );

    emit({ type: "stage", label: t(lang, "stageDownloadVideo") });
    emit({ type: "progress", stage: "download", percent: 0 });
    const stored = await saveVideoBuffer(
      info.url,
      {
        filename: `${name}.mp4`,
        mime: "video/mp4",
        ext: "mp4",
        headers: {
          Referer: info.referer,
          "User-Agent": DESKTOP_UA,
          ...(info.headers || {}),
        },
      },
      makeProgress(emit)
    );
    emit({ type: "progress", stage: "download", percent: 100 });

    recordDownload({
      tipo: "video",
      calidad: info.calidad,
      titulo: info.titulo || details.titulo,
      videoId,
      tamano: stored.size,
    });

    const base = `${req.protocol}://${req.get("host")}`;
    const data = {
      id: stored.id,
      downloadUrl: `${base}/d/${stored.id}.${stored.ext}`,
      filename: stored.filename,
      size: stored.size,
      calidad: info.calidad,
      titulo: info.titulo || details.titulo,
      canal: details.canal,
      duracion: info.duracion,
      miniatura: details.miniatura,
      expiraEn: getTTLSeconds(),
    };
    if (sse) {
      emit({ type: "done", data });
      res.end();
    } else {
      res.json({ ok: true, data });
    }
  } catch (error: any) {
    const message = error?.message || t(lang, "videoError");
    if (sse) {
      emit({ type: "error", message });
      res.end();
    } else {
      res.status(500).json({ ok: false, error: message });
    }
  } finally {
    endDownload();
  }
});

app.post("/api/audio", async (req, res) => {
  const lang = pickLang(req.body?.lang);
  const limitError = beginDownload(req.ip || "unknown", lang);
  const videoId = extractVideoId(String(req.body?.url || ""));
  const quality = Number(req.body?.quality || 128);

  if (limitError) {
    res.status(429).json({ ok: false, error: limitError });
    return;
  }
  if (!videoId) {
    endDownload();
    res.status(400).json({ ok: false, error: t(lang, "invalidUrl") });
    return;
  }
  if (![96, 128, 256, 320].includes(quality)) {
    endDownload();
    res.status(400).json({ ok: false, error: t(lang, "invalidAudioQuality") });
    return;
  }

  const sse = sseStart(req, res);
  const emit: EmitFn = (event) => {
    if (sse) sseWrite(res, event);
  };

  try {
    emit({ type: "stage", label: t(lang, "stageSearch") });
    const [info, details] = await Promise.all([
      raceScrapers<AudioInfo>(
        [
          (signal) => y2mateAudio(videoId, quality, signal),
          (signal) => cnvmp3Audio(videoId, quality as AudioQuality, signal),
          (signal) =>
            savetubeAudio(`https://www.youtube.com/watch?v=${videoId}`, signal),
          (signal) =>
            yt2songAudio(
              `https://www.youtube.com/watch?v=${videoId}`,
              quality,
              signal
            ),
        ],
        lang
      ),
      fetchVideoDetails(videoId),
    ]);
    const filename = sanitizeFilename(
      (info.archivo || details.titulo || "audio").replace(/\.mp3$/, "")
    );

    emit({ type: "stage", label: t(lang, "stageDownloadAudio") });
    emit({ type: "progress", stage: "download", percent: 0 });
    const stream = info.stream
      ? info.stream
      : (
          await axios.get(info.url as string, {
            responseType: "stream",
            timeout: 180000,
            headers: {
              Referer: info.referer,
              "User-Agent": DESKTOP_UA,
              ...(info.headers || {}),
            },
          })
        ).data;
    const stored = await saveAudioBuffer(
      stream,
      {
        filename: `${filename}.mp3`,
        mime: "audio/mpeg",
        ext: "mp3",
      },
      makeProgress(emit)
    );
    emit({ type: "progress", stage: "download", percent: 100 });

    recordDownload({
      tipo: "audio",
      calidad: info.calidad || `${quality} kbps`,
      titulo: details.titulo,
      videoId,
      tamano: stored.size,
    });

    const base = `${req.protocol}://${req.get("host")}`;
    const data = {
      id: stored.id,
      downloadUrl: `${base}/d/${stored.id}.${stored.ext}`,
      filename: stored.filename,
      size: stored.size,
      calidad: info.calidad || `${quality} kbps`,
      titulo: details.titulo,
      canal: details.canal,
      duracion: 0,
      miniatura: details.miniatura,
      expiraEn: getTTLSeconds(),
    };
    if (sse) {
      emit({ type: "done", data });
      res.end();
    } else {
      res.json({ ok: true, data });
    }
  } catch (error: any) {
    const message = error?.message || t(lang, "audioError");
    if (sse) {
      emit({ type: "error", message });
      res.end();
    } else {
      res.status(500).json({ ok: false, error: message });
    }
  } finally {
    endDownload();
  }
});

app.get("/d/:file", async (req, res) => {
  const match = String(req.params.file || "").match(
    /^([A-Za-z0-9]{6,10})(?:\.(mp4|mp3))?$/i
  );
  const lang = pickLang(req.headers["accept-language"]);
  if (!match) {
    res.status(404).type("text/plain").send(t(lang, "notFound"));
    return;
  }
  const record = await resolveFile(match[1]);
  if (!record) {
    res.status(404).type("text/plain").send(t(lang, "notFound"));
    return;
  }
  res.setHeader("Content-Type", record.mime);
  res.setHeader("Content-Length", String(record.size));
  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(record.filename)}`
  );
  res.setHeader("Cache-Control", "private, max-age=60");
  createFileStream(record).pipe(res);
});

app.use(express.static(path.join(process.cwd(), "public")));

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`YPi listo en http://0.0.0.0:${PORT}`);
});

cleanupOldFiles().then((removed) => {
  if (removed > 0)
    console.log(`Limpieza: ${removed} archivos expirados eliminados.`);
});
// con TTL de 3 minutos, limpiamos cada minuto
setInterval(() => {
  cleanupOldFiles().catch(() => undefined);
}, 60 * 1000);
