import { randomBytes } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Request, Response } from "express";
import { fetch } from "undici";
import {
  DESKTOP_UA,
  dispatcher,
  normalizeHttpUrl,
  sanitizeFilename,
  withTimeout,
} from "./utils";

/**
 * Tickets efímeros para transferencias por proxy.
 * Solo guardamos metadatos y la URL firmada en memoria: el MP3/MP4 nunca se
 * escribe al disco del servidor. Cuando el cliente abre /p/:id, la respuesta
 * del proveedor se conecta directamente al response HTTP del cliente.
 */
const TTL_MS = 2 * 60 * 1000;
const MAX_TICKETS = 120;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export type ProxyKind = "audio" | "video";

export interface ProxyTicketInput {
  url: string;
  referer: string;
  headers?: Record<string, string>;
  filename: string;
  mime: string;
  kind: ProxyKind;
  quality: string;
  title: string | null;
  videoId: string;
}

export interface ProxyTicket extends ProxyTicketInput {
  id: string;
  createdAt: number;
  active: boolean;
}

const tickets = new Map<string, ProxyTicket>();

function makeId(): string {
  return randomBytes(18).toString("base64url");
}

function expired(ticket: ProxyTicket, now = Date.now()): boolean {
  return now - ticket.createdAt > TTL_MS;
}

export function cleanupProxyTickets(now = Date.now()): number {
  let removed = 0;
  for (const [id, ticket] of tickets) {
    if (!ticket.active && expired(ticket, now)) {
      tickets.delete(id);
      removed += 1;
    }
  }
  return removed;
}

export function getProxyTTLSeconds(): number {
  return Math.round(TTL_MS / 1000);
}

export function createProxyTicket(input: ProxyTicketInput): ProxyTicket {
  cleanupProxyTickets();

  // Si muchos enlaces han expirado mientras había streams activos, limitamos
  // el mapa sin tocar un stream en curso.
  if (tickets.size >= MAX_TICKETS) {
    const oldest = [...tickets.values()]
      .filter((ticket) => !ticket.active)
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) tickets.delete(oldest.id);
  }

  let id = makeId();
  while (tickets.has(id)) id = makeId();

  const ticket: ProxyTicket = {
    ...input,
    id,
    url: normalizeHttpUrl(input.url),
    filename: sanitizeFilename(input.filename),
    createdAt: Date.now(),
    active: false,
  };
  tickets.set(id, ticket);
  return ticket;
}

export function findProxyTicket(id: string): ProxyTicket | null {
  if (!TOKEN_PATTERN.test(id)) return null;
  const ticket = tickets.get(id);
  if (!ticket) return null;
  if (expired(ticket)) {
    tickets.delete(id);
    return null;
  }
  return ticket;
}

function safeRange(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const range = value.trim();
  // Permitimos rangos de byte normales (incluidos varios rangos) sin reenviar
  // cabeceras arbitrarias al proveedor.
  return /^bytes=\d*-\d*(?:,\d*-\d*)*$/.test(range) ? range : null;
}

function setIfPresent(res: Response, name: string, value: string | null): void {
  if (value) res.setHeader(name, value);
}

/**
 * Reenvía un media stream sin bufferizarlo ni escribir archivos temporales.
 * Devuelve el número de bytes que llegaron al cliente para estadísticas.
 */
export async function streamProxyTicket(
  ticket: ProxyTicket,
  req: Request,
  res: Response
): Promise<number> {
  if (ticket.active) {
    throw new Error("PROXY_BUSY");
  }

  ticket.active = true;
  const controller = new AbortController();
  let finished = false;
  const cancelUpstream = () => {
    if (!finished) controller.abort();
  };
  req.once("aborted", cancelUpstream);
  res.once("close", cancelUpstream);

  try {
    const range = safeRange(req.headers.range);
    const upstream = await fetch(ticket.url, {
      method: "GET",
      headers: {
        Accept: "*/*",
        "User-Agent": DESKTOP_UA,
        Referer: ticket.referer,
        ...(range ? { Range: range } : {}),
        ...(ticket.headers || {}),
      },
      dispatcher,
      redirect: "follow",
      signal: withTimeout(controller.signal, 180000),
    });

    if ((!upstream.ok && upstream.status !== 206) || !upstream.body) {
      throw new Error(`UPSTREAM_${upstream.status}`);
    }

    res.status(upstream.status);
    res.setHeader("Content-Type", ticket.mime);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(ticket.filename)}`
    );
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Accel-Buffering", "no");
    setIfPresent(res, "Content-Length", upstream.headers.get("content-length"));
    setIfPresent(res, "Content-Range", upstream.headers.get("content-range"));
    setIfPresent(res, "Accept-Ranges", upstream.headers.get("accept-ranges"));

    let bytes = 0;
    const stream = Readable.fromWeb(upstream.body as any);
    stream.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
    });

    await pipeline(stream, res);
    finished = true;
    return bytes;
  } finally {
    finished = true;
    ticket.active = false;
    req.off("aborted", cancelUpstream);
    res.off("close", cancelUpstream);
  }
}
