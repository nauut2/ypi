import express from "express";
import path from "node:path";
import {
  createProxyTicket,
  cleanupProxyTickets,
  findProxyTicket,
  getProxyTTLSeconds,
  streamProxyTicket,
} from "./proxy";
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
import { fetchVideoDetails } from "./services/oembed";
import {
  ytmp4 as savetubeVideo,
  ytmp3 as savetubeAudio,
} from "./services/savetube";
import { getStats, recordDownload } from "./stats";
import { extractVideoId, sanitizeFilename } from "./utils";

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

const PREPARE_CONCURRENT_MAX = 4;
const PROXY_CONCURRENT_MAX = 4;
const PER_IP_LIMIT = 5;
const PER_IP_WINDOW = 60_000;
let activePreparations = 0;
let activeProxyStreams = 0;
const hits = new Map<string, number[]>();

const T = {
  es: {
    rateLimited: "Demasiadas peticiones. Espera un momento.",
    busy: "Hay muchas conversiones en curso. Inténtalo en unos segundos.",
    proxyBusy: "Hay muchas transferencias por proxy en curso. Inténtalo de nuevo.",
    invalidUrl: "El enlace de YouTube no es válido.",
    invalidVideoQuality: "Calidad de video no válida (360, 480, 720 o 1080).",
    invalidAudioQuality: "Calidad de audio no válida.",
    stageSearch: "Buscando un origen de media…",
    stageDetails: "Obteniendo detalles del video…",
    stageProxy: "Creando un enlace de proxy temporal…",
    videoError: "No se pudo preparar el proxy de video.",
    audioError: "No se pudo preparar el proxy de audio.",
    raceFail: "No se pudo preparar un enlace de proxy. Inténtalo en unos segundos.",
    proxyExpired: "El enlace de proxy no existe o expiró.",
    proxyUnavailable: "No se pudo conectar con el origen del archivo.",
  },
  en: {
    rateLimited: "Too many requests. Please wait a moment.",
    busy: "Too many conversions are in progress. Try again in a few seconds.",
    proxyBusy: "Too many proxy streams are in progress. Please try again.",
    invalidUrl: "The YouTube link is not valid.",
    invalidVideoQuality: "Invalid video quality (360, 480, 720 or 1080).",
    invalidAudioQuality: "Invalid audio quality.",
    stageSearch: "Finding a media source…",
    stageDetails: "Getting video details…",
    stageProxy: "Creating a temporary proxy link…",
    videoError: "Could not prepare the video proxy.",
    audioError: "Could not prepare the audio proxy.",
    raceFail: "Could not prepare a proxy link. Try again in a few seconds.",
    proxyExpired: "This proxy link does not exist or has expired.",
    proxyUnavailable: "Could not reach the file source.",
  },
} as const;

type TranslationKey = keyof typeof T.es;

function t(lang: string, key: TranslationKey): string {
  return (lang === "en" ? T.en : T.es)[key];
}

function pickLang(value: unknown): string {
  return String(value || "").toLowerCase().startsWith("en") ? "en" : "es";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((time) => now - time < PER_IP_WINDOW);
  if (recent.length >= PER_IP_LIMIT) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function beginPreparation(ip: string, lang: string): string | null {
  if (rateLimited(ip)) return t(lang, "rateLimited");
  if (activePreparations >= PREPARE_CONCURRENT_MAX) return t(lang, "busy");
  activePreparations += 1;
  return null;
}

function endPreparation(): void {
  activePreparations = Math.max(0, activePreparations - 1);
}

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

interface VideoInfo {
  url: string;
  referer: string;
  headers?: Record<string, string>;
  calidad: string;
  titulo: string | null;
  duracion: number;
}

interface AudioInfo {
  url: string;
  archivo: string;
  referer: string;
  headers?: Record<string, string>;
  calidad?: string;
}

// Los proveedores se consultan en paralelo; el primer enlace de media válido
// gana. No se descarga ni guarda el archivo en esta fase.
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
  return raceScrapers<VideoInfo>(
    [
      (signal) => y2mateVideo(videoId, quality, signal),
      (signal) => cnvmp3Video(videoId, quality, signal),
      (signal) => savetubeVideo(fullUrl, quality, signal),
      (signal) => androidVideo(videoId, quality, signal),
    ],
    lang
  );
}

function makeAbsoluteProxyUrl(req: express.Request, id: string): string {
  return `${req.protocol}://${req.get("host")}/p/${id}`;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    servicio: "ypi",
    modo: "proxy-stream",
    tiempo: Math.round(process.uptime()),
  });
});

app.get("/api/stats", (_req, res) => {
  res.json({ ok: true, data: getStats() });
});

app.post("/api/video", async (req, res) => {
  const lang = pickLang(req.body?.lang);
  const limitError = beginPreparation(req.ip || "unknown", lang);
  const videoId = extractVideoId(String(req.body?.url || ""));
  const quality = Number(req.body?.quality || 360);

  if (limitError) {
    res.status(429).json({ ok: false, error: limitError });
    return;
  }
  if (!videoId) {
    endPreparation();
    res.status(400).json({ ok: false, error: t(lang, "invalidUrl") });
    return;
  }
  if (![360, 480, 720, 1080].includes(quality)) {
    endPreparation();
    res.status(400).json({ ok: false, error: t(lang, "invalidVideoQuality") });
    return;
  }

  const sse = sseStart(req, res);
  const emit: EmitFn = (event) => {
    if (sse) sseWrite(res, event);
  };

  try {
    emit({ type: "stage", label: t(lang, "stageDetails") });
    const [info, details] = await Promise.all([
      fetchVideo(`https://www.youtube.com/watch?v=${videoId}`, quality, emit, lang),
      fetchVideoDetails(videoId),
    ]);
    const filename = `${sanitizeFilename(
      (info.titulo || details.titulo || "video").replace(/\.mp4$/i, "")
    )}.mp4`;

    emit({ type: "stage", label: t(lang, "stageProxy") });
    const ticket = createProxyTicket({
      url: info.url,
      referer: info.referer,
      headers: info.headers,
      filename,
      mime: "video/mp4",
      kind: "video",
      quality: info.calidad,
      title: info.titulo || details.titulo,
      videoId,
    });

    const data = {
      downloadUrl: makeAbsoluteProxyUrl(req, ticket.id),
      filename: ticket.filename,
      size: 0,
      calidad: info.calidad,
      titulo: info.titulo || details.titulo,
      canal: details.canal,
      duracion: info.duracion,
      miniatura: details.miniatura,
      expiraEn: getProxyTTLSeconds(),
      proxied: true,
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
    endPreparation();
  }
});

app.post("/api/audio", async (req, res) => {
  const lang = pickLang(req.body?.lang);
  const limitError = beginPreparation(req.ip || "unknown", lang);
  const videoId = extractVideoId(String(req.body?.url || ""));
  const quality = Number(req.body?.quality || 128);

  if (limitError) {
    res.status(429).json({ ok: false, error: limitError });
    return;
  }
  if (!videoId) {
    endPreparation();
    res.status(400).json({ ok: false, error: t(lang, "invalidUrl") });
    return;
  }
  if (![96, 128, 256, 320].includes(quality)) {
    endPreparation();
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
        ],
        lang
      ),
      fetchVideoDetails(videoId),
    ]);
    const filename = `${sanitizeFilename(
      (info.archivo || details.titulo || "audio").replace(/\.mp3$/i, "")
    )}.mp3`;

    emit({ type: "stage", label: t(lang, "stageProxy") });
    const ticket = createProxyTicket({
      url: info.url,
      referer: info.referer,
      headers: info.headers,
      filename,
      mime: "audio/mpeg",
      kind: "audio",
      quality: info.calidad || `${quality} kbps`,
      title: details.titulo,
      videoId,
    });

    const data = {
      downloadUrl: makeAbsoluteProxyUrl(req, ticket.id),
      filename: ticket.filename,
      size: 0,
      calidad: info.calidad || `${quality} kbps`,
      titulo: details.titulo,
      canal: details.canal,
      duracion: 0,
      miniatura: details.miniatura,
      expiraEn: getProxyTTLSeconds(),
      proxied: true,
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
    endPreparation();
  }
});

app.get("/p/:id", async (req, res) => {
  const lang = pickLang(req.headers["accept-language"]);
  const ticket = findProxyTicket(String(req.params.id || ""));
  if (!ticket) {
    res.status(404).type("text/plain").send(t(lang, "proxyExpired"));
    return;
  }
  if (activeProxyStreams >= PROXY_CONCURRENT_MAX) {
    res.status(503).type("text/plain").send(t(lang, "proxyBusy"));
    return;
  }

  activeProxyStreams += 1;
  try {
    const bytes = await streamProxyTicket(ticket, req, res);
    if (bytes > 0) {
      recordDownload({
        tipo: ticket.kind === "video" ? "video" : "audio",
        calidad: ticket.quality,
        titulo: ticket.title,
        videoId: ticket.videoId,
        tamano: bytes,
      });
    }
  } catch (error: any) {
    if (!res.headersSent) {
      const status = error?.message === "PROXY_BUSY" ? 409 : 502;
      res.status(status).type("text/plain").send(
        error?.message === "PROXY_BUSY" ? t(lang, "proxyBusy") : t(lang, "proxyUnavailable")
      );
    } else if (!res.writableEnded) {
      res.destroy();
    }
  } finally {
    activeProxyStreams = Math.max(0, activeProxyStreams - 1);
  }
});

app.use(express.static(path.join(process.cwd(), "public")));

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`YPi proxy listo en http://0.0.0.0:${PORT}`);
});

setInterval(() => cleanupProxyTickets(), 30_000);
