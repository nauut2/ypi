/* YPi · interfaz bilingüe ES/EN */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const I18N = {
    es: {
      metaTitle: "YPi · Conversor de YouTube",
      metaDesc: "YPi convierte enlaces de YouTube a MP4 o MP3 con una interfaz rápida, clara y bilingüe.",
      brandHome: "YPi — inicio",
      mainNav: "Navegación principal",
      navConvert: "Convertir",
      navGuide: "Guía",
      online: "En línea",
      onlineTitle: "Servicio disponible",
      language: "Idioma",
      eyebrow: "CONVERSOR DE MEDIOS",
      heroTitle: "Tu enlace.",
      heroAccent: "Tu archivo.",
      heroCopy: "Convierte videos públicos de YouTube a MP4 o MP3 en unos pasos, sin crear una cuenta.",
      legalInline: "Usa solo contenido que tengas derecho a descargar.",
      downloadTitle: "Convertir enlace",
      noAccount: "sin cuenta",
      urlLabel: "ENLACE DE YOUTUBE",
      urlPlaceholder: "https://youtube.com/watch?v=…",
      paste: "Pegar",
      pasteTitle: "Pegar desde el portapapeles",
      formatLabel: "FORMATO",
      qualityLabel: "CALIDAD",
      video: "Video",
      audio: "Audio",
      compatibility: "Videos, Shorts y enlaces youtu.be",
      downloadBtn: "Crear descarga",
      processing: "Preparando conversión…",
      ready: "Tu archivo está listo",
      thumbnailAlt: "Miniatura del video",
      directLink: "ENLACE DIRECTO",
      copy: "Copiar",
      downloadFile: "Descargar archivo",
      statsTitle: "Actividad",
      statTotal: "DESCARGAS TOTALES",
      statVideos: "Videos MP4",
      statAudios: "Audios MP3",
      statToday: "Hoy",
      guideTitle: "Así de simple",
      step1Title: "Pega una URL",
      step1Text: "Aceptamos enlaces de videos, Shorts y youtu.be.",
      step2Title: "Elige formato y calidad",
      step2Text: "Selecciona MP4 para video o MP3 para audio.",
      step3Title: "Guarda el archivo",
      step3Text: "Recibe una descarga directa temporal al terminar.",
      footer: "conversor de medios personal",
      footerNote: "No afiliado con YouTube o Google. Respeta los derechos y las condiciones de uso.",
      noUrl: "Pega primero un enlace de YouTube.",
      badUrl: "Ese enlace no parece ser una URL de YouTube válida.",
      serverError: "El servidor no pudo completar la solicitud.",
      connectionClosed: "La conexión se cerró antes de terminar la conversión.",
      failed: "No se pudo completar la descarga.",
      clipboardUnavailable: "No se pudo leer el portapapeles. Pega el enlace manualmente.",
      pasted: "Enlace pegado.",
      copied: "Enlace copiado al portapapeles.",
      copiedShort: "Enlace copiado.",
      preparingVideo: "Preparando MP4 {q}p…",
      preparingAudio: "Preparando MP3 {q} kbps…",
      converting: "Convirtiendo…",
      downloading: "Descargando archivo…",
      searching: "Buscando un conversor disponible…",
      duration: "Duración {value}",
      expiresMin: "expira en {n} min",
      expiresHour: "expira en {n} h",
      hint: "Enlace temporal: {expiry}",
      doneToast: "Listo. Tu archivo está disponible.",
    },
    en: {
      metaTitle: "YPi · YouTube Converter",
      metaDesc: "YPi converts YouTube links to MP4 or MP3 with a quick, clear bilingual interface.",
      brandHome: "YPi — home",
      mainNav: "Main navigation",
      navConvert: "Convert",
      navGuide: "Guide",
      online: "Online",
      onlineTitle: "Service available",
      language: "Language",
      eyebrow: "MEDIA CONVERTER",
      heroTitle: "Your link.",
      heroAccent: "Your file.",
      heroCopy: "Convert public YouTube videos to MP4 or MP3 in a few steps, with no account required.",
      legalInline: "Only use content you have the right to download.",
      downloadTitle: "Convert a link",
      noAccount: "no account",
      urlLabel: "YOUTUBE LINK",
      urlPlaceholder: "https://youtube.com/watch?v=…",
      paste: "Paste",
      pasteTitle: "Paste from clipboard",
      formatLabel: "FORMAT",
      qualityLabel: "QUALITY",
      video: "Video",
      audio: "Audio",
      compatibility: "Videos, Shorts and youtu.be links",
      downloadBtn: "Create download",
      processing: "Preparing conversion…",
      ready: "Your file is ready",
      thumbnailAlt: "Video thumbnail",
      directLink: "DIRECT LINK",
      copy: "Copy",
      downloadFile: "Download file",
      statsTitle: "Activity",
      statTotal: "TOTAL DOWNLOADS",
      statVideos: "MP4 videos",
      statAudios: "MP3 audio",
      statToday: "Today",
      guideTitle: "As simple as this",
      step1Title: "Paste a URL",
      step1Text: "We accept video, Shorts and youtu.be links.",
      step2Title: "Choose format and quality",
      step2Text: "Select MP4 for video or MP3 for audio.",
      step3Title: "Save the file",
      step3Text: "Receive a temporary direct download when it is ready.",
      footer: "personal media converter",
      footerNote: "Not affiliated with YouTube or Google. Respect rights and terms of use.",
      noUrl: "Paste a YouTube link first.",
      badUrl: "That does not look like a valid YouTube URL.",
      serverError: "The server could not complete the request.",
      connectionClosed: "The connection closed before the conversion finished.",
      failed: "The download could not be completed.",
      clipboardUnavailable: "The clipboard could not be read. Please paste the link manually.",
      pasted: "Link pasted.",
      copied: "Link copied to your clipboard.",
      copiedShort: "Link copied.",
      preparingVideo: "Preparing MP4 {q}p…",
      preparingAudio: "Preparing MP3 {q} kbps…",
      converting: "Converting…",
      downloading: "Downloading file…",
      searching: "Looking for an available converter…",
      duration: "Duration {value}",
      expiresMin: "expires in {n} min",
      expiresHour: "expires in {n} h",
      hint: "Temporary link: {expiry}",
      doneToast: "Done. Your file is available.",
    },
  };

  // Product copy for the polished download experience. The stream-through
  // architecture remains invisible to the visitor while still avoiding disk storage.
  Object.assign(I18N.es, {
    metaTitle: "YPi · Descargador de YouTube",
    metaDesc: "YPi prepara descargas temporales de YouTube en MP4 o MP3, sin registros ni archivos guardados.",
    navConvert: "Inicio",
    navActivity: "Actividad",
    profileRole: "YouTube media downloader",
    profileDescription: "Pega un enlace, elige el formato y recibe una descarga temporal sin registros ni archivos guardados.",
    features: "Funciones de YPi",
    fastTag: "RÁPIDO",
    theme: "Tema",
    themeToggle: "Cambiar entre tema claro y oscuro",
    downloadTitle: "Descargar",
    online: "en línea",
    downloadNotice: "Tu enlace se prepara al instante y el archivo no queda guardado.",
    downloadBtn: "Generar enlace",
    processing: "Preparando descarga…",
    ready: "Enlace listo",
    readyState: "disponible ahora",
    directLink: "ENLACE DE DESCARGA",
    downloadFile: "Descargar archivo",
    statsTitle: "Actividad",
    statTotal: "DESCARGAS TOTALES",
    statVideos: "Video MP4",
    statAudios: "Audio MP3",
    footer: "YouTube downloader",
    footerNote: "Sin registros, sin archivos guardados. No afiliado con YouTube o Google.",
    preparingVideo: "Preparando MP4 {q}p…",
    preparingAudio: "Preparando MP3 {q} kbps…",
    downloading: "Preparando enlace de descarga…",
    searching: "Buscando una descarga disponible…",
    hint: "Enlace temporal: {expiry} · el archivo no queda guardado",
    doneToast: "Listo. Tu enlace de descarga ya está disponible.",
  });

  Object.assign(I18N.en, {
    metaTitle: "YPi · YouTube Downloader",
    metaDesc: "YPi prepares temporary YouTube downloads in MP4 or MP3, with no sign-up and no stored files.",
    navConvert: "Home",
    navActivity: "Activity",
    profileRole: "YouTube media downloader",
    profileDescription: "Paste a link, choose a format and get a temporary download without sign-ups or stored files.",
    features: "YPi features",
    fastTag: "FAST",
    theme: "Theme",
    themeToggle: "Switch between light and dark theme",
    downloadTitle: "Download",
    online: "online",
    downloadNotice: "Your link is prepared instantly and the file is never stored.",
    downloadBtn: "Generate link",
    processing: "Preparing download…",
    ready: "Link ready",
    readyState: "available now",
    directLink: "DOWNLOAD LINK",
    downloadFile: "Download file",
    statsTitle: "Activity",
    statTotal: "TOTAL DOWNLOADS",
    statVideos: "MP4 video",
    statAudios: "MP3 audio",
    footer: "YouTube downloader",
    footerNote: "No sign-ups, no stored files. Not affiliated with YouTube or Google.",
    preparingVideo: "Preparing MP4 {q}p…",
    preparingAudio: "Preparing MP3 {q} kbps…",
    downloading: "Preparing download link…",
    searching: "Finding an available download…",
    hint: "Temporary link: {expiry} · the file is never stored",
    doneToast: "Done. Your download link is now available.",
  });

  const VIDEO_QUALITIES = [360, 480, 720, 1080];
  const AUDIO_QUALITIES = [128, 96, 256, 320];

  const urlInput = $("url");
  const pasteButton = $("paste");
  const goButton = $("go");
  const qualityPills = $("qualityPills");
  const formatButtons = Array.from(document.querySelectorAll(".format-btn"));
  const progress = $("progress");
  const progressText = $("progressText");
  const progressFill = $("progressFill");
  const progressPct = $("progressPct");
  const result = $("result");
  const statsSection = $("stats");
  const toasts = $("toasts");

  let mode = "video";
  let quality = 360;
  let lang = detectLanguage();
  let lastResult = null;
  let lastStats = null;
  let lastProgressStage = "download";
  let lastProgressPercent = -1;
  let lastStageLabel = "";

  function detectLanguage() {
    try {
      const saved = localStorage.getItem("ypi-lang");
      if (saved === "es" || saved === "en") return saved;
    } catch {
      // Private browsing or blocked storage: use browser language instead.
    }
    return (navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es";
  }

  function t(key, vars = {}) {
    const text = I18N[lang]?.[key] ?? I18N.es[key] ?? key;
    return String(text).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
  }

  function applyLanguage() {
    document.documentElement.lang = lang;
    document.title = t("metaTitle");
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute("content", t("metaDesc"));

    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;
      if (key) element.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      const key = element.dataset.i18nPlaceholder;
      if (key) element.setAttribute("placeholder", t(key));
    });
    document.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      const key = element.dataset.i18nAria;
      if (key) element.setAttribute("aria-label", t(key));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      const key = element.dataset.i18nTitle;
      if (key) element.setAttribute("title", t(key));
    });
    document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
      const key = element.dataset.i18nAlt;
      if (key) element.setAttribute("alt", t(key));
    });

    const es = $("langEs");
    const en = $("langEn");
    es.classList.toggle("is-active", lang === "es");
    en.classList.toggle("is-active", lang === "en");
    es.setAttribute("aria-pressed", String(lang === "es"));
    en.setAttribute("aria-pressed", String(lang === "en"));

    if (lastResult) renderResult(lastResult);
    if (lastStats) renderStats(lastStats, true);
    if (!progress.hidden) updateProgressText();
  }

  function setLanguage(next) {
    if (next !== "es" && next !== "en") return;
    if (lang === next) return;
    lang = next;
    try {
      localStorage.setItem("ypi-lang", lang);
    } catch {
      // Language still changes for this visit.
    }
    applyLanguage();
  }

  $("langEs").addEventListener("click", () => setLanguage("es"));
  $("langEn").addEventListener("click", () => setLanguage("en"));

  const themeToggle = $("themeToggle");
  const themeIcon = $("themeIcon");

  function preferredTheme() {
    try {
      const saved = localStorage.getItem("ypi-theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch {
      // Storage is optional; use the system preference below.
    }
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function updateThemeIcon(theme) {
    if (!themeIcon) return;
    themeIcon.innerHTML =
      theme === "light"
        ? '<path d="M20 12.8A8 8 0 1 1 11.2 4 6.2 6.2 0 0 0 20 12.8Z" />'
        : '<circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />';
  }

  function applyTheme(theme) {
    const isLight = theme === "light";
    document.documentElement.classList.toggle("light", isLight);
    themeToggle?.setAttribute("aria-pressed", String(isLight));
    updateThemeIcon(theme);
    try {
      localStorage.setItem("ypi-theme", theme);
    } catch {
      // The selected theme still applies for the current visit.
    }
  }

  themeToggle?.addEventListener("click", () => {
    applyTheme(document.documentElement.classList.contains("light") ? "dark" : "light");
  });

  function buildQualityPills(values, active) {
    qualityPills.innerHTML = "";
    values.forEach((value) => {
      const button = document.createElement("button");
      const isActive = value === active;
      button.type = "button";
      button.className = `quality-pill${isActive ? " is-active" : ""}`;
      button.dataset.quality = String(value);
      button.textContent = String(value);
      button.setAttribute("aria-pressed", String(isActive));
      button.setAttribute(
        "aria-label",
        mode === "video" ? `${value}p` : `${value} kbps`
      );
      button.addEventListener("click", () => {
        quality = value;
        qualityPills.querySelectorAll(".quality-pill").forEach((pill) => {
          const selected = pill === button;
          pill.classList.toggle("is-active", selected);
          pill.setAttribute("aria-pressed", String(selected));
        });
      });
      qualityPills.appendChild(button);
    });
    const unit = document.createElement("span");
    unit.className = "quality-unit";
    unit.textContent = mode === "video" ? "p" : "kbps";
    qualityPills.appendChild(unit);
  }

  function setMode(next) {
    if (next !== "video" && next !== "audio") return;
    mode = next;
    quality = mode === "video" ? 360 : 128;
    formatButtons.forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    buildQualityPills(mode === "video" ? VIDEO_QUALITIES : AUDIO_QUALITIES, quality);
  }

  formatButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toast(message, kind = "ok") {
    const node = document.createElement("div");
    node.className = `toast${kind === "error" ? " is-error" : ""}`;
    node.innerHTML = `<span class="toast-mark">${kind === "error" ? "×" : "✓"}</span><span>${escapeHtml(message)}</span>`;
    toasts.appendChild(node);
    window.setTimeout(() => {
      node.style.opacity = "0";
      node.style.transform = "translateY(6px)";
      node.style.transition = "opacity .18s ease, transform .18s ease";
      window.setTimeout(() => node.remove(), 200);
    }, 4400);
  }

  function formatBytes(bytes) {
    const amount = Number(bytes || 0);
    if (!Number.isFinite(amount) || amount <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let value = amount;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit += 1;
    }
    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  function formatDuration(seconds) {
    const total = Number(seconds || 0);
    if (!Number.isFinite(total) || total <= 0) return "";
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = Math.floor(total % 60);
    const pad = (number) => String(number).padStart(2, "0");
    return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
  }

  function extractVideoId(input) {
    const clean = input.trim();
    const patterns = [
      /youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/|v\/)([\w-]{11})/i,
      /youtu\.be\/([\w-]{11})/i,
      /[?&]v=([\w-]{11})/i,
      /^([\w-]{11})$/,
    ];
    return patterns.some((pattern) => pattern.test(clean));
  }

  function setProgress(percent) {
    const value = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    progressFill.style.width = `${value}%`;
    progressPct.textContent = `${value}%`;
  }

  function updateProgressText() {
    if (lastProgressPercent >= 0) {
      progressText.textContent =
        lastProgressStage === "convert"
          ? `${t("converting")} ${Math.round(lastProgressPercent)}%`
          : `${t("downloading")} ${Math.round(lastProgressPercent)}%`;
      return;
    }
    progressText.textContent = lastStageLabel || t("processing");
  }

  function handleProgressEvent(event) {
    if (event.type === "stage") {
      lastStageLabel = event.label || t("searching");
      lastProgressPercent = -1;
      progressText.textContent = lastStageLabel;
      return;
    }
    if (event.type === "progress") {
      const percent = Number(event.percent);
      if (Number.isFinite(percent) && percent >= 0) {
        lastProgressPercent = percent;
        lastProgressStage = event.stage === "convert" ? "convert" : "download";
        setProgress(percent);
        updateProgressText();
      }
    }
  }

  async function requestDownload() {
    const url = urlInput.value.trim();
    if (!url) {
      toast(t("noUrl"), "error");
      urlInput.focus();
      return;
    }
    if (!extractVideoId(url)) {
      toast(t("badUrl"), "error");
      urlInput.focus();
      return;
    }

    goButton.disabled = true;
    urlInput.disabled = true;
    pasteButton.disabled = true;
    result.hidden = true;
    progress.hidden = false;
    lastProgressPercent = -1;
    lastStageLabel = "";
    setProgress(0);
    progressText.textContent =
      mode === "video"
        ? t("preparingVideo", { q: quality })
        : t("preparingAudio", { q: quality });

    try {
      const response = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json",
        },
        body: JSON.stringify({ url, quality, lang }),
      });
      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("text/event-stream")) {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || t("serverError"));
        }
        showResult(payload.data);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error(t("connectionClosed"));
      const decoder = new TextDecoder();
      let buffer = "";
      let complete = false;
      let failure = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let breakAt = buffer.indexOf("\n\n");
        while (breakAt !== -1) {
          const chunk = buffer.slice(0, breakAt);
          buffer = buffer.slice(breakAt + 2);
          const dataLine = chunk.split("\n").find((line) => line.startsWith("data: "));
          if (dataLine) {
            try {
              const event = JSON.parse(dataLine.slice(6));
              if (event.type === "stage" || event.type === "progress") handleProgressEvent(event);
              if (event.type === "done") {
                showResult(event.data);
                complete = true;
              }
              if (event.type === "error") failure = event.message || t("serverError");
            } catch {
              // Ignore an incomplete/malformed SSE line and keep reading.
            }
          }
          if (complete || failure) break;
          breakAt = buffer.indexOf("\n\n");
        }
        if (complete || failure) break;
      }

      if (failure) throw new Error(failure);
      if (!complete) throw new Error(t("connectionClosed"));
    } catch (error) {
      toast(error instanceof Error ? error.message : t("failed"), "error");
    } finally {
      goButton.disabled = false;
      urlInput.disabled = false;
      pasteButton.disabled = false;
      progress.hidden = true;
      progressFill.style.width = "0%";
      progressPct.textContent = "0%";
      lastProgressPercent = -1;
      lastStageLabel = "";
    }
  }

  function renderResult(data) {
    if (!data) return;
    const thumb = $("rThumb");
    const title = $("rTitle");
    const meta = $("rMeta");
    const chips = $("rChips");
    const link = $("rLink");
    const hint = $("rHint");

    if (data.miniatura) {
      thumb.style.display = "block";
      thumb.dataset.failed = "";
      thumb.alt = data.titulo || t("thumbnailAlt");
      thumb.onerror = () => {
        if (!thumb.dataset.failed && thumb.src.includes("maxresdefault")) {
          thumb.dataset.failed = "fallback";
          thumb.src = thumb.src.replace("maxresdefault", "hqdefault");
          return;
        }
        thumb.style.display = "none";
      };
      thumb.src = data.miniatura;
    } else {
      thumb.style.display = "none";
    }

    title.textContent = data.titulo || t("ready");
    const duration = formatDuration(data.duracion);
    meta.textContent = duration ? t("duration", { value: duration }) : data.canal || "";

    chips.innerHTML = "";
    [
      { text: data.calidad, ok: true },
      { text: formatBytes(data.size), ok: false },
      { text: data.filename, ok: false },
    ]
      .filter((item) => item.text && item.text !== "—")
      .forEach((item) => {
        const chip = document.createElement("span");
        chip.className = `chip${item.ok ? " is-ok" : ""}`;
        chip.textContent = item.text;
        chips.appendChild(chip);
      });

    link.value = data.downloadUrl || "";
    $("rDownload").href = data.downloadUrl || "#";

    const seconds = Number(data.expiraEn || 180);
    const minutes = Math.max(1, Math.round(seconds / 60));
    const expiry =
      seconds < 3600
        ? t("expiresMin", { n: minutes })
        : t("expiresHour", { n: Math.round(seconds / 3600) });
    hint.textContent = t("hint", { expiry });
  }

  function showResult(data) {
    lastResult = data;
    renderResult(data);
    result.hidden = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    result.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
    toast(t("doneToast"));
    loadStats();
  }

  function numberFormat(value) {
    return Number(value || 0).toLocaleString(lang === "en" ? "en-US" : "es-MX");
  }

  function animateCount(element, target, skipAnimation) {
    const finalValue = Number(target || 0);
    if (skipAnimation || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      element.textContent = numberFormat(finalValue);
      element.dataset.value = String(finalValue);
      return;
    }
    const initial = Number(element.dataset.value || "0");
    const started = performance.now();
    const duration = 550;
    const tick = (now) => {
      const progressValue = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progressValue, 3);
      element.textContent = numberFormat(Math.round(initial + (finalValue - initial) * eased));
      if (progressValue < 1) requestAnimationFrame(tick);
      else element.dataset.value = String(finalValue);
    };
    requestAnimationFrame(tick);
  }

  function renderStats(stats, skipAnimation = false) {
    if (!stats) return;
    statsSection.hidden = false;
    [
      ["statTotal", stats.total],
      ["statVideos", stats.videos],
      ["statAudios", stats.audios],
      ["statToday", stats.hoy],
    ].forEach(([id, value]) => animateCount($(id), value, skipAnimation));
  }

  async function loadStats() {
    try {
      const response = await fetch("/api/stats", { headers: { Accept: "application/json" } });
      const payload = await response.json();
      if (!response.ok || !payload?.ok || !payload.data) return;
      lastStats = payload.data;
      renderStats(lastStats);
    } catch {
      // Statistics are optional; the converter should work without them.
    }
  }

  $("rCopy").addEventListener("click", async () => {
    const link = $("rLink");
    if (!link.value) return;
    try {
      await navigator.clipboard.writeText(link.value);
      toast(t("copied"));
    } catch {
      link.focus();
      link.select();
      link.setSelectionRange(0, link.value.length);
      document.execCommand("copy");
      toast(t("copiedShort"));
    }
  });

  pasteButton.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      urlInput.value = text.trim();
      urlInput.focus();
      toast(t("pasted"));
      if (urlInput.value.includes("shorts/") && mode !== "video") setMode("video");
    } catch {
      toast(t("clipboardUnavailable"), "error");
      urlInput.focus();
    }
  });

  goButton.addEventListener("click", requestDownload);
  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") requestDownload();
  });
  urlInput.addEventListener("paste", () => {
    window.setTimeout(() => {
      if (urlInput.value.includes("shorts/") && mode !== "video") setMode("video");
    }, 0);
  });

  applyTheme(preferredTheme());
  applyLanguage();
  setMode("video");
  loadStats();
})();
