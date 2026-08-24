# YPi · Media Proxy

<p align="center">
  <img src="./public/logo.svg" width="112" alt="YPi logo">
</p>

> A bilingual YouTube media proxy. Paste a public YouTube URL, choose MP4 or MP3, and receive a short-lived proxy URL. **YPi never stores the media file on disk.**

## What changed in proxy mode

- **Stream-only delivery** — the selected provider stream is piped straight to the browser through `/p/:token`; there is no `downloads/` directory, temporary media file, or local media cache.
- **Ephemeral, opaque proxy links** — the provider URL and its required headers stay server-side in memory. Links expire automatically after two minutes.
- **No open proxy** — clients can only use a random ticket created after a supported YouTube conversion; they cannot pass arbitrary target URLs to the proxy endpoint.
- **Provider race** — Y2Mate/Y2Meta (`cnv.cx`), cnvmp3, SaveTube, and the Android YouTube fallback race to provide a valid source.
- **Exact-quality protection** — incompatible lower-resolution results are rejected instead of being labelled as the requested quality.
- **Spanish / English interface** — language choice is kept in local storage.

## Requirements

| Requirement | Purpose |
| --- | --- |
| Bun 1.x | Runtime and package manager |
| Node.js 20+ | Supported toolchain/runtime dependency |

## Install

```bash
git clone https://github.com/nauut2/ypi.git
cd ypi
bun install
bun run dev
```

The site runs on `http://localhost:3000` by default. Set `PORT` to change it.

## Use

1. Paste a YouTube video, Short, or `youtu.be` link.
2. Pick **MP4** or **MP3** and a quality.
3. Create a temporary proxy link.
4. Open the link to stream the provider response to the browser as a download.

Media is never written to the server filesystem. The only persistent local data is optional aggregate download statistics in SQLite.

## API

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/video` | `POST` | Accepts `{ url, quality, lang }`; returns SSE events and an ephemeral MP4 proxy link. |
| `/api/audio` | `POST` | Accepts `{ url, quality, lang }`; returns SSE events and an ephemeral MP3 proxy link. |
| `/p/:token` | `GET` | Streams the ticket's provider media directly to the client. No media is saved locally. |
| `/api/stats` | `GET` | Aggregate completed proxy stream statistics. |
| `/health` | `GET` | Service status (`modo: "proxy-stream"`). |

Example:

```bash
curl -N -X POST http://localhost:3000/api/audio \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"url":"https://www.youtube.com/watch?v=…","quality":128,"lang":"en"}'
```

## Project structure

```text
ypi/
├── public/                # bilingual interface and local logo
├── src/
│   ├── index.ts           # Express API, SSE and proxy route
│   ├── proxy.ts           # in-memory tickets + stream-through proxy
│   ├── services/          # Y2Mate, cnvmp3, SaveTube and Android sources
│   ├── stats.ts           # aggregate SQLite counters only
│   └── utils.ts           # URL and media inspection helpers
└── package.json
```

## Legal notice

YPi is not affiliated with YouTube or Google. Use it only for content you have the right to access and download, and comply with applicable terms and copyright law.
