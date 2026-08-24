# YPi · Media Proxy

<p align="center">
  <img src="./public/logo.svg" width="112" alt="Logo de YPi">
</p>

> Proxy bilingüe para media de YouTube. Pega una URL pública, elige MP4 o MP3 y recibe una URL de proxy temporal. **YPi nunca guarda el archivo multimedia en disco.**

## Modo proxy

- **Solo streaming** — el stream del proveedor se conecta directamente al navegador a través de `/p/:token`; no existe directorio `downloads/`, archivo temporal ni caché local de media.
- **Enlaces efímeros y opacos** — la URL del proveedor y sus headers necesarios se mantienen en memoria. Los enlaces expiran automáticamente después de dos minutos.
- **No es un proxy abierto** — el cliente solo puede usar un ticket aleatorio creado tras una conversión de YouTube compatible; no puede enviar URLs arbitrarias al endpoint de proxy.
- **Carrera de proveedores** — Y2Mate/Y2Meta (`cnv.cx`), cnvmp3, SaveTube y el fallback Android de YouTube compiten para entregar un origen válido.
- **Protección de calidad exacta** — los resultados de menor resolución incompatibles se rechazan en vez de etiquetarse falsamente con la calidad solicitada.
- **Interfaz español / inglés** — el idioma elegido se conserva en el navegador.

## Requisitos

| Requisito | Uso |
| --- | --- |
| Bun 1.x | Runtime y gestor de paquetes |
| Node.js 20+ | Toolchain/runtime compatible |

## Instalación

```bash
git clone https://github.com/nauut2/ypi.git
cd ypi
bun install
bun run dev
```

La aplicación corre por defecto en `http://localhost:3000`. Usa `PORT` para cambiarlo.

## Uso

1. Pega un enlace de video, Short o `youtu.be`.
2. Elige **MP4** o **MP3** y una calidad.
3. Crea un enlace de proxy temporal.
4. Abre el enlace para transmitir la respuesta del proveedor directamente al navegador como descarga.

La media nunca se escribe en el sistema de archivos del servidor. El único dato local persistente opcional son contadores agregados de transferencias en SQLite.

## API

| Endpoint | Método | Descripción |
| --- | --- | --- |
| `/api/video` | `POST` | Recibe `{ url, quality, lang }`; devuelve eventos SSE y un proxy MP4 efímero. |
| `/api/audio` | `POST` | Recibe `{ url, quality, lang }`; devuelve eventos SSE y un proxy MP3 efímero. |
| `/p/:token` | `GET` | Transmite la media del proveedor al cliente. No guarda media local. |
| `/api/stats` | `GET` | Estadísticas agregadas de streams proxy terminados. |
| `/health` | `GET` | Estado del servicio (`modo: "proxy-stream"`). |

Ejemplo:

```bash
curl -N -X POST http://localhost:3000/api/audio \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"url":"https://www.youtube.com/watch?v=…","quality":128,"lang":"es"}'
```

## Estructura

```text
ypi/
├── public/                # interfaz bilingüe y logo local
├── src/
│   ├── index.ts           # API Express, SSE y ruta proxy
│   ├── proxy.ts           # tickets en memoria + proxy de streaming
│   ├── services/          # orígenes Y2Mate, cnvmp3, SaveTube y Android
│   ├── stats.ts           # solo contadores agregados SQLite
│   └── utils.ts           # URL y utilidades de inspección
└── package.json
```

## Aviso legal

YPi no está afiliado con YouTube ni Google. Úsalo solo con contenido al que tengas derecho de acceder o descargar, y respeta las condiciones aplicables y los derechos de autor.
