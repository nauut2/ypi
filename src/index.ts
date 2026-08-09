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
import { ytmp3, AudioQuality } from "./services/cnvmp3";
import { ytmp4 as convert1sVideo } from "./services/convert1s";
import { fetchVideoDetails } from "./services/oembed";
import { ytmp4 as savetubeVideo } from "./services/savetube";
import { DESKTOP_UA, extractVideoId, sanitizeFilename } from "./utils";

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");

app.use(express.json({ limit: "100kb" }));

// ---- Protecciones simples -------------------------------------------------

const CONCURRENT_MAX = 4;
const PER_IP_LIMIT = 5;
const PER_IP_WINDOW = 60_000;
let activeDownloads = 0;
const hits = new Map<string, number[]>();

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

function beginDownload(ip: string): string | null {
  if (rateLimited(ip)) return "Demasiadas peticiones. Espera un momento.";
  if (activeDownloads >= CONCURRENT_MAX) {
    return "Hay muchas descargas en curso. Inténtalo en unos segundos.";
  }
  activeDownloads++;
  return null;
}

function endDownload(): void {
  activeDownloads = Math.max(0, activeDownloads - 1);
}

// ---- Progreso (SSE) --------------------------------------------------------

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

/** Emisor de progreso con throttle (máx. 1 evento por 200ms y por punto). */
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

// ---- Utilidades de video ---------------------------------------------------

interface VideoInfo {
  url: string;
  referer: string;
  calidad: string;
  titulo: string | null;
  duracion: number;
}

/** SaveTube como motor principal; Convert1s como respaldo automático. */
async function fetchVideo(
  fullUrl: string,
  quality: number,
  emit: EmitFn
): Promise<VideoInfo> {
  try {
    return await savetubeVideo(fullUrl, quality);
  } catch {
    emit({ type: "stage", label: "Cambiando de servidor de conversión…" });
    return await convert1sVideo(fullUrl, quality, undefined, false, (pct) =>
      emit({ type: "progress", stage: "convert", percent: pct })
    );
  }
}

// ---- Rutas API -------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({ ok: true, servicio: "ypi", tiempo: Math.round(process.uptime()) });
});

app.post("/api/video", async (req, res) => {
  const limitError = beginDownload(req.ip || "unknown");
  const videoId = extractVideoId(String(req.body?.url || ""));
  const quality = Number(req.body?.quality || 360);

  if (limitError) {
    res.status(429).json({ ok: false, error: limitError });
    return;
  }
  if (!videoId) {
    endDownload();
    res.status(400).json({ ok: false, error: "El enlace de YouTube no es válido." });
    return;
  }
  if (![360, 720, 1080].includes(quality)) {
    endDownload();
    res.status(400).json({ ok: false, error: "Calidad de video no válida (360, 720 o 1080)." });
    return;
  }

  const sse = sseStart(req, res);
  const emit: EmitFn = (event) => {
    if (sse) sseWrite(res, event);
  };

  try {
    emit({ type: "stage", label: "Obteniendo detalles del video…" });
    const info = await fetchVideo(
      `https://www.youtube.com/watch?v=${videoId}`,
      quality,
      emit
    );
    const details = await fetchVideoDetails(videoId);

    const name = sanitizeFilename(
      (info.titulo || details.titulo || "video").replace(/\.mp4$/i, "")
    );

    emit({ type: "stage", label: "Descargando el archivo MP4…" });
    emit({ type: "progress", stage: "download", percent: 0 });
    const stored = await saveVideoBuffer(
      info.url,
      {
        filename: `${name}.mp4`,
        mime: "video/mp4",
        ext: "mp4",
        headers: { Referer: info.referer, "User-Agent": DESKTOP_UA },
      },
      makeProgress(emit)
    );
    emit({ type: "progress", stage: "download", percent: 100 });

    const base = `${req.protocol}://${req.get("host")}`;
    const data = {
      id: stored.id,
      downloadUrl: `${base}/d/${stored.id}`,
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
    const message = error?.message || "Error al descargar el video.";
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
  const limitError = beginDownload(req.ip || "unknown");
  const videoId = extractVideoId(String(req.body?.url || ""));
  const quality = Number(req.body?.quality || 128);

  if (limitError) {
    res.status(429).json({ ok: false, error: limitError });
    return;
  }
  if (!videoId) {
    endDownload();
    res.status(400).json({ ok: false, error: "El enlace de YouTube no es válido." });
    return;
  }
  if (![96, 128, 256, 320].includes(quality)) {
    endDownload();
    res.status(400).json({ ok: false, error: "Calidad de audio no válida." });
    return;
  }

  const sse = sseStart(req, res);
  const emit: EmitFn = (event) => {
    if (sse) sseWrite(res, event);
  };

  try {
    emit({ type: "stage", label: "Obteniendo detalles del video…" });
    const [info, details] = await Promise.all([
      ytmp3(videoId, quality as AudioQuality),
      fetchVideoDetails(videoId),
    ]);
    const filename = sanitizeFilename(
      (info.archivo || details.titulo || "audio").replace(/\.mp3$/, "")
    );

    emit({ type: "stage", label: "Descargando el archivo MP3…" });
    emit({ type: "progress", stage: "download", percent: 0 });
    const stream = await axios.get(info.url, {
      responseType: "stream",
      timeout: 180000,
      headers: { Referer: info.referer, "User-Agent": DESKTOP_UA },
    });
    const stored = await saveAudioBuffer(
      stream.data,
      {
        filename: `${filename}.mp3`,
        mime: "audio/mpeg",
        ext: "mp3",
      },
      makeProgress(emit)
    );
    emit({ type: "progress", stage: "download", percent: 100 });

    const base = `${req.protocol}://${req.get("host")}`;
    const data = {
      id: stored.id,
      downloadUrl: `${base}/d/${stored.id}`,
      filename: stored.filename,
      size: stored.size,
      calidad: `${quality} kbps`,
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
    const message = error?.message || "Error al descargar el audio.";
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

// ---- Enlace corto ----------------------------------------------------------

app.get("/d/:id", async (req, res) => {
  const record = await resolveFile(req.params.id);
  if (!record) {
    res.status(404).type("text/plain").send("Archivo no encontrado o expirado.");
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

// ---- Frontend --------------------------------------------------------------

app.use(express.static(path.join(process.cwd(), "public")));

// ---- Arranque --------------------------------------------------------------

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`YPi listo en http://0.0.0.0:${PORT}`);
});

cleanupOldFiles().then((removed) => {
  if (removed > 0)
    console.log(`Limpieza: ${removed} archivos expirados eliminados.`);
});
// Con TTL de 3 minutos, limpiamos cada minuto.
setInterval(() => {
  cleanupOldFiles().catch(() => undefined);
}, 60 * 1000);
