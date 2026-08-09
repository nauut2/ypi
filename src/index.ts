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
import { ytmp4 } from "./services/convert1s";
import { fetchVideoDetails } from "./services/oembed";
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

// ---- Rutas API -------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({ ok: true, servicio: "ypi", tiempo: Math.round(process.uptime()) });
});

app.post("/api/video", async (req, res) => {
  const limitError = beginDownload(req.ip || "unknown");
  if (limitError) {
    res.status(429).json({ ok: false, error: limitError });
    return;
  }
  try {
    const videoId = extractVideoId(String(req.body?.url || ""));
    if (!videoId) {
      res
        .status(400)
        .json({ ok: false, error: "El enlace de YouTube no es válido." });
      return;
    }
    const quality = Number(req.body?.quality || 360);
    if (![360, 720, 1080].includes(quality)) {
      res
        .status(400)
        .json({ ok: false, error: "Calidad de video no válida (360, 720 o 1080)." });
      return;
    }

    const [info, details] = await Promise.all([
      ytmp4(`https://www.youtube.com/watch?v=${videoId}`, quality),
      fetchVideoDetails(videoId),
    ]);
    const name = sanitizeFilename(
      (info.titulo || details.titulo || info.archivo || "video").replace(
        /\.mp4$/i,
        ""
      )
    );
    const stored = await saveVideoBuffer(info.url, {
      filename: `${name}.mp4`,
      mime: "video/mp4",
      ext: "mp4",
      headers: { Referer: info.referer, "User-Agent": DESKTOP_UA },
    });

    const base = `${req.protocol}://${req.get("host")}`;
    res.json({
      ok: true,
      data: {
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
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ ok: false, error: error?.message || "Error al descargar el video." });
  } finally {
    endDownload();
  }
});

app.post("/api/audio", async (req, res) => {
  const limitError = beginDownload(req.ip || "unknown");
  if (limitError) {
    res.status(429).json({ ok: false, error: limitError });
    return;
  }
  try {
    const videoId = extractVideoId(String(req.body?.url || ""));
    if (!videoId) {
      res
        .status(400)
        .json({ ok: false, error: "El enlace de YouTube no es válido." });
      return;
    }
    const quality = Number(req.body?.quality || 128);
    if (![96, 128, 256, 320].includes(quality)) {
      res
        .status(400)
        .json({ ok: false, error: "Calidad de audio no válida." });
      return;
    }

    const [info, details] = await Promise.all([
      ytmp3(videoId, quality as AudioQuality),
      fetchVideoDetails(videoId),
    ]);
    const filename = sanitizeFilename(
      (info.archivo || details.titulo || "audio").replace(/\.mp3$/, "")
    );
    const stream = await axios.get(info.url, {
      responseType: "stream",
      timeout: 180000,
      headers: { Referer: info.referer, "User-Agent": DESKTOP_UA },
    });

    const stored = await saveAudioBuffer(stream.data, {
      filename: `${filename}.mp3`,
      mime: "audio/mpeg",
      ext: "mp3",
    });

    const base = `${req.protocol}://${req.get("host")}`;
    res.json({
      ok: true,
      data: {
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
      },
    });
  } catch (error: any) {
    res
      .status(500)
      .json({ ok: false, error: error?.message || "Error al descargar el audio." });
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
  res.setHeader("Cache-Control", "private, max-age=3600");
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
setInterval(() => {
  cleanupOldFiles().catch(() => undefined);
}, 60 * 60 * 1000);
