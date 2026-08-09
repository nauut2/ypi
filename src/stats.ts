import { mkdirSync } from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";

// ruta sobreescribible para pruebas; por defecto data/stats.db
const DB_PATH =
  process.env.YPI_STATS_DB || path.join(process.cwd(), "data", "stats.db");

export interface DownloadRecord {
  tipo: "video" | "audio";
  calidad: string;
  titulo: string | null;
  videoId: string | null;
  tamano: number;
}

export interface Stats {
  total: number;
  videos: number;
  audios: number;
  hoy: number;
}

interface StatsRow {
  total: number;
  videos: number;
  audios: number;
  hoy: number;
}

let db: Database | null = null;

function init(): Database | null {
  if (db) return db;
  try {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const database = new Database(DB_PATH, { create: true });
    database.run(`
      CREATE TABLE IF NOT EXISTS downloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        calidad TEXT NOT NULL DEFAULT '',
        titulo TEXT,
        video_id TEXT,
        tamano INTEGER NOT NULL DEFAULT 0,
        creado_en INTEGER NOT NULL
      )
    `);
    db = database;
    return db;
  } catch (error) {
    // si SQLite falla, las descargas no deben romperse
    console.error("[stats] No se pudo abrir la base de datos:", error);
    return null;
  }
}

export function recordDownload(entry: DownloadRecord): void {
  const database = init();
  if (!database) return;
  try {
    database
      .query(
        `INSERT INTO downloads (tipo, calidad, titulo, video_id, tamano, creado_en)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.tipo,
        entry.calidad || "",
        entry.titulo ?? null,
        entry.videoId ?? null,
        entry.tamano || 0,
        Date.now()
      );
  } catch (error) {
    console.error("[stats] No se pudo registrar la descarga:", error);
  }
}

function startOfDay(): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
}

export function getStats(): Stats {
  const database = init();
  if (!database) return { total: 0, videos: 0, audios: 0, hoy: 0 };
  try {
    const row = database
      .query<StatsRow>(
        `SELECT
           COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN tipo = 'video' THEN 1 ELSE 0 END), 0) AS videos,
           COALESCE(SUM(CASE WHEN tipo = 'audio' THEN 1 ELSE 0 END), 0) AS audios,
           COALESCE(SUM(CASE WHEN creado_en >= ? THEN 1 ELSE 0 END), 0) AS hoy
         FROM downloads`
      )
      .get(startOfDay());
    return {
      total: Number(row?.total ?? 0),
      videos: Number(row?.videos ?? 0),
      audios: Number(row?.audios ?? 0),
      hoy: Number(row?.hoy ?? 0),
    };
  } catch (error) {
    console.error("[stats] No se pudieron leer las estadísticas:", error);
    return { total: 0, videos: 0, audios: 0, hoy: 0 };
  }
}
