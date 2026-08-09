# YPi 🌿

<p align="center">
<img src="https://i.ibb.co/hRmc03Sd/2D.jpg" width="120px" alt="Logo YPi">
</p>

> Descargador de **YouTube** minimalista, moderno y responsive: descarga el video en **MP4 (360p/480p/720p/1080p)** o el audio en **MP3** y obtén un **enlace directo corto** al archivo guardado en el servidor.

<p align="center">
<img src="https://img.shields.io/badge/Status-Activo-22c55e?style=flat" alt="Status">
<img src="https://img.shields.io/badge/Node.js-v20+-16a34a?style=flat&logo=nodedotjs&logoColor=white" alt="Node.js">
<img src="https://img.shields.io/badge/TypeScript-5.x-3178c6?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
<img src="https://img.shields.io/badge/Express-4.x-0f172a?style=flat&logo=express&logoColor=white" alt="Express">
<img src="https://img.shields.io/badge/Runtime-Bun-f9f9f9?style=flat&logo=bun&logoColor=black" alt="Bun">
</p>

<p align="center">
<a href="https://github.com/nauut2/ypi">
<img src="https://img.shields.io/badge/Repositorio-YPi-7c3aed?style=for-the-badge&logo=github&logoColor=white" alt="Repositorio">
</a>
</p>

> [!NOTE]
> **YPi** está pensado para ofrecer una experiencia limpia y sin fricción: pegas un enlace, eliges formato y recibes un enlace directo. Los archivos se guardan localmente y **expiran automáticamente a los 3 minutos** (suficiente para descargar y limpiar el servidor).

---

## 🎬 Descripción

**YPi** es una página web de descarga de YouTube con un backend en **TypeScript** que integra varios motores de descarga:

- **Video MP4 (360p, 480p, 720p y 1080p)** — se consultan varios motores en paralelo y responde el primero que consiga la calidad exacta.
- **Audio MP3 (96, 128, 256 y 320 kbps)** — también con varios motores en paralelo.
- **Detalles del video** (título, canal y miniatura) — desde el API público de YouTube.

Al solicitar una descarga, el servidor **descarga el buffer del archivo, lo guarda localmente** y genera un **enlace corto** (`/d/AbC123xY`) que detecta automáticamente el dominio actual para que siempre funcione. La interfaz muestra el **porcentaje real de descarga** en tiempo real.

## 🍡 Requisitos

| Requisito | Descripción |
|---|---|
| Node.js v20+ | Para ejecutar el servidor |
| Bun 1.x | Para instalar dependencias y ejecutar los scripts |

<p>
<a href="https://nodejs.org/en/download"><img src="https://img.shields.io/badge/Node.js-1e3a8a?style=flat&logo=nodedotjs&logoColor=white" alt="Node.js"></a>
<a href="https://bun.sh/docs/installation"><img src="https://img.shields.io/badge/Bun-f9f9f9?style=flat&logo=bun&logoColor=black" alt="Bun"></a>
</p>

---

## 🍡 Instalación =>

<details>
<summary><strong>🍃 Linux / macOS / Windows</summary>

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

> La app estará disponible en `http://localhost:3000` (respetando la variable `PORT` si existe).

</details>

<details>
<summary><strong>🍀 Producción</summary>

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

> 🦎 No se necesitan variables de entorno ni claves API para funcionar.

---

## 📦 Uso

### Desde la web

1. Pega el enlace de YouTube (video, Short o `youtu.be`).
2. Elige **Video · MP4** (360p/480p/720p/1080p) o **Audio · MP3** (96/128/256/320 kbps).
3. Pulsa **Descargar** y sigue el **progreso real** hasta recibir tu enlace directo.

### API

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/video` | `POST` | `{ "url": "…", "quality": 360 \| 480 \| 720 \| 1080 }` → video MP4 (SSE con progreso) |
| `/api/audio` | `POST` | `{ "url": "…", "quality": 128 }` → audio MP3 (96/128/256/320) |
| `/d/:id` | `GET` | Descarga directa del archivo guardado |
| `/health` | `GET` | Estado del servicio |

**Ejemplo:**

```bash
curl -X POST http://localhost:3000/api/audio \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","quality":128}'
```

```json
{
  "ok": true,
  "data": {
    "id": "8dj9vC8r",
    "downloadUrl": "http://localhost:3000/d/8dj9vC8r",
    "filename": "Rick Astley - Never Gonna Give You Up.mp3",
    "size": 472670,
    "calidad": "128 kbps",
    "expiraEn": 180
  }
}
```

---

## 🧬 Estructura del proyecto

```txt
ypi/
├── public/                 # Frontend (HTML · CSS · JS)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── src/                    # Backend TypeScript
│   ├── index.ts            # Servidor Express + rutas API + enlace corto + progreso SSE
│   ├── utils.ts            # Utilidades (videoId, resolución MP4, timeouts)
│   ├── storage.ts          # Guardado local, IDs cortos, expiración 3 min
│   └── services/           # Motores de descarga (video y audio)
├── downloads/              # Archivos descargados (se limpian solos)
├── package.json
└── tsconfig.json
```

---

> 🍀 ¿Quieres contribuir? Las aportaciones son bienvenidas mediante **issues** y **pull requests**.

---

## ⚖️ Aclaración legal

> Este proyecto **no está afiliado a YouTube ni a Google**.
> Es una herramienta independiente para uso personal y educativo.
> **Respeta los derechos de autor** y las condiciones de servicio de YouTube al descargar contenido.

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
