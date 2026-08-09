# YPi 🌿

<p align="center">
<img src="https://i.ibb.co/hRmc03Sd/2D.jpg" width="120px" alt="YPi logo">
</p>

> Minimalist, modern and responsive **YouTube** downloader: get your video as **MP4 (360p/480p/720p/1080p)** or your audio as **MP3**, plus a **short direct link** to the file stored on the server.

<p align="center">
<img src="https://img.shields.io/badge/Status-Active-22c55e?style=flat" alt="Status">
<img src="https://img.shields.io/badge/Node.js-v20+-16a34a?style=flat&logo=nodedotjs&logoColor=white" alt="Node.js">
<img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/Express-4.x-0f172a?style=flat&logo=express&logoColor=white" alt="Express">
<img src="https://img.shields.io/badge/Runtime-Bun-f9f9f9?style=flat&logo=bun&logoColor=black" alt="Bun">
</p>

<p align="center">
<a href="https://github.com/nauut2/ypi">
<img src="https://img.shields.io/badge/Repository-YPi-7c3aed?style=for-the-badge&logo=github&logoColor=white" alt="Repository">
</a>
<a href="./README.es.md">
<img src="https://img.shields.io/badge/Español-README-16a34a?style=for-the-badge" alt="Read in Spanish">
</a>
</p>

> [!NOTE]
> **YPi** is built for a clean, frictionless experience: paste a link, pick a format, get a direct link. Files are stored locally and **expire automatically after 3 minutes** — plenty of time to download while keeping the server tidy.

---

## 🎬 Overview

**YPi** is a YouTube downloader web app with a **TypeScript** backend that combines several download engines:

- **MP4 video (360p, 480p, 720p & 1080p)** — engines run in parallel and the first one to deliver the **exact** quality wins (it never silently downgrades).
- **MP3 audio (96, 128, 256 & 320 kbps)** — also raced in parallel; the fastest response wins.
- **Video details** (title, channel and thumbnail) — fetched from YouTube's public API.
- **Real download progress** — the UI shows the actual percentage of the download as it happens.
- **Bilingual UI** — switch between Spanish and English at any time (ES/EN toggle in the header, remembered on your next visit).

When you request a download, the server **downloads the file buffer, saves it locally** and generates a **short link** (`/d/AbC123xY`) that automatically detects the current domain, so it always works. The interface shows the **real download percentage** in real time.

## 🍡 Requirements

| Requirement | Description |
|---|---|
| Node.js v20+ | To run the server |
| Bun 1.x | To install dependencies and run the scripts |

<p>
<a href="https://nodejs.org/en/download"><img src="https://img.shields.io/badge/Node.js-1e3a8a?style=flat&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
<a href="https://bun.sh/docs/installation"><img src="https://img.shields.io/badge/Bun-f9f9f9?style=flat&logo=bun&logoColor=black" alt="Bun"></a>
</p>

---

## 🍡 Installation

<details>
<summary><strong>🍃 Linux / macOS / Windows</strong></summary>

```bash
git clone https://github.com/nauut2/ypi.git
```
```bash
cd ypi
```
```bash
bun install
```
```bash
bun run dev
```

> The app will be available at `http://localhost:3000` (respecting the `PORT` variable if set).

</details>

<details>
<summary><strong>🍀 Production</strong></summary>

```bash
bun install
```
```bash
bun run build
```
```bash
bun start
```

</details>

> 🦎 No environment variables or API keys needed.

---

## 📦 Usage

### From the web

1. Paste the YouTube link (video, Short or `youtu.be`).
2. Choose **Video · MP4** (360p/480p/720p/1080p) or **Audio · MP3** (96/128/256/320 kbps).
3. Hit **Download** and follow the **real progress** until you get your direct link.

### API

| Endpoint | Method | Description |
|---|---|---|
| `/api/video` | `POST` | `{ "url": "…", "quality": 360 \| 480 \| 720 \| 1080, "lang": "es" \| "en" }` → MP4 video (SSE progress) |
| `/api/audio` | `POST` | `{ "url": "…", "quality": 128, "lang": "es" \| "en" }` → MP3 audio (96/128/256/320) |
| `/d/:id.mp4` · `/d/:id.mp3` | `GET` | Direct download of the stored file (with extension) |
| `/health` | `GET` | Service status |

**Example:**

```bash
curl -X POST http://localhost:3000/api/audio \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","quality":128,"lang":"en"}'
```

```json
{
  "ok": true,
  "data": {
    "id": "8dj9vC8r",
    "downloadUrl": "http://localhost:3000/d/8dj9vC8r.mp3",
    "filename": "Rick Astley - Never Gonna Give You Up.mp3",
    "size": 472670,
    "calidad": "128 kbps",
    "expiraEn": 180
  }
}
```

---

## 🧬 Project structure

```txt
ypi/
├── public/                 # Frontend (HTML · CSS · JS)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/                    # TypeScript backend
│   ├── index.ts            # Express server + API routes + short links + SSE progress
│   ├── utils.ts            # Utilities (videoId, MP4 resolution, timeouts)
│   ├── storage.ts          # Local storage, short IDs, 3-minute expiry
│   └── services/           # Download engines (video & audio)
├── downloads/              # Downloaded files (self-cleaning)
├── package.json
└── tsconfig.json
```

---

> 🍀 Want to contribute? Pull requests and issues are welcome.

---

## ⚖️ Legal notice

> This project is **not affiliated with YouTube or Google**.
> It is an independent tool for personal and educational use.
> **Respect copyright** and YouTube's terms of service when downloading content.

---

<p align="center">
<a href="https://github.com/nauut2">
<img src="https://img.shields.io/badge/Powered%20by-Naut-7c3aed?style=for-the-badge&logo=github&logoColor=white" alt="Powered by Naut">
</a>
</p>
<p align="center">
<a href="https://github.com/nauut2">
<img src="https://github.com/nauut2.png?size=130" width="130px">
</a>
</p>
