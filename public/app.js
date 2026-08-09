/* YPi · descargador de YouTube (es/en) */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  // diccionario de textos: es por defecto, en traducido
  const I18N = {
    es: {
      online: "En línea",
      theme: "Tema",
      kicker: "YouTube Downloader · 100% Gratis",
      heroTitle1: "Descarga videos y",
      heroTitle2: "audio",
      heroTitle3: "de YouTube",
      heroSub:
        "Pega un enlace, elige el formato y recibe un enlace directo al archivo. Sin registros, sin anuncios, sin complicaciones.",
      downloadTitle: "Descargar",
      downloadSub: "Pega el enlace de YouTube — video, Short o enlace compartido.",
      downloadBtn: "Descargar",
      video: "Video",
      audio: "Audio",
      quality: "Calidad",
      processing: "Procesando…",
      copy: "Copiar",
      downloadFile: "Descargar archivo",
      step1Title: "Pega el enlace",
      step1Text: "Copia cualquier URL de YouTube — videos, Shorts o enlaces compartidos.",
      step2Title: "Elige el formato",
      step2Text: "Video MP4 hasta 1080p con audio, o audio MP3 hasta 320 kbps.",
      step3Title: "Obtén tu enlace",
      step3Text: "El archivo se guarda en el servidor y recibes un enlace directo y corto.",
      statTotal: "Descargas totales",
      statVideos: "Videos MP4",
      statAudios: "Audios MP3",
      statToday: "Hoy",
      // dinámicos
      noUrl: "Pega primero un enlace de YouTube.",
      badUrl: "El enlace no parece ser de YouTube.",
      serverError: "Error inesperado del servidor.",
      connectionClosed: "La conexión con el servidor se cerró antes de terminar.",
      failed: "No se pudo completar la descarga.",
      duration: "Duración",
      thumbAlt: "Miniatura del video",
      ready: "Descarga lista",
      expiresMin: "expira en {n} min",
      expiresHour: "expira en {n} h",
      hint: "El enlace {expiry} · se guardó localmente en el servidor",
      doneToast: "Listo. Descarga tu archivo.",
      copied: "Enlace copiado al portapapeles.",
      copiedShort: "Enlace copiado.",
      preparingVideo: "Preparando MP4 {q}p…",
      preparingAudio: "Preparando MP3 {q} kbps…",
      converting: "Convirtiendo…",
      downloading: "Descargando…",
      metaTitle: "YPi · Descargador de YouTube",
      metaDesc: "YPi — descarga videos MP4 y audio MP3 de YouTube al instante. Minimalista, rápido y sin registros.",
    },
    en: {
      online: "Online",
      theme: "Theme",
      kicker: "YouTube Downloader · 100% Free",
      heroTitle1: "Download videos and",
      heroTitle2: "audio",
      heroTitle3: "from YouTube",
      heroSub:
        "Paste a link, choose the format and get a direct link to the file. No sign-ups, no ads, no hassle.",
      downloadTitle: "Download",
      downloadSub: "Paste a YouTube link — video, Short or shared link.",
      downloadBtn: "Download",
      video: "Video",
      audio: "Audio",
      quality: "Quality",
      processing: "Processing…",
      copy: "Copy",
      downloadFile: "Download file",
      step1Title: "Paste the link",
      step1Text: "Copy any YouTube URL — videos, Shorts or shared links.",
      step2Title: "Pick the format",
      step2Text: "MP4 video up to 1080p with audio, or MP3 audio up to 320 kbps.",
      step3Title: "Get your link",
      step3Text: "The file is saved on the server and you get a short direct link.",
      statTotal: "Total downloads",
      statVideos: "MP4 videos",
      statAudios: "MP3 audio",
      statToday: "Today",
      // dynamic
      noUrl: "Paste a YouTube link first.",
      badUrl: "That doesn't look like a YouTube link.",
      serverError: "Unexpected server error.",
      connectionClosed: "The connection to the server closed before finishing.",
      failed: "The download could not be completed.",
      duration: "Duration",
      thumbAlt: "Video thumbnail",
      ready: "Download ready",
      expiresMin: "expires in {n} min",
      expiresHour: "expires in {n} h",
      hint: "The link {expiry} · saved locally on the server",
      doneToast: "Done. Download your file.",
      copied: "Link copied to clipboard.",
      copiedShort: "Link copied.",
      preparingVideo: "Preparing MP4 {q}p…",
      preparingAudio: "Preparing MP3 {q} kbps…",
      converting: "Converting…",
      downloading: "Downloading…",
      metaTitle: "YPi · YouTube Downloader",
      metaDesc: "YPi — download MP4 videos and MP3 audio from YouTube instantly. Minimalist, fast and no sign-up.",
    },
  };

  const urlInput = $("url");
  const goBtn = $("go");
  const segBtns = Array.from(document.querySelectorAll(".seg-btn"));
  const qualityPills = $("qualityPills");
  const progress = $("progress");
  const progressText = $("progressText");
  const progressFill = $("progressFill");
  const progressPct = $("progressPct");
  const result = $("result");
  const toasts = $("toasts");
  const statsSection = $("stats");

  const VIDEO_QUALITIES = [360, 480, 720, 1080];
  const AUDIO_QUALITIES = [128, 96, 256, 320];

  let mode = "video";
  let quality = 360;
  let lang = "es";

  // idioma: lo que guardó el usuario o el del navegador
  try {
    lang =
      localStorage.getItem("ypi-lang") ||
      (navigator.language || "es").toLowerCase().startsWith("en")
        ? "en"
        : "es";
  } catch {
    lang = "es";
  }

  function t(key, vars = {}) {
    const text = (I18N[lang] && I18N[lang][key]) || I18N.es[key] || key;
    return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
  }

  function applyLang() {
    document.documentElement.lang = lang;
    document.title = t("metaTitle");
    document
      .querySelector('meta[name="description"]')
      .setAttribute("content", t("metaDesc"));
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.dataset.i18n);
    });
    const esBtn = $("langEs");
    const enBtn = $("langEn");
    esBtn.classList.toggle("active", lang === "es");
    enBtn.classList.toggle("active", lang === "en");
    esBtn.setAttribute("aria-pressed", String(lang === "es"));
    enBtn.setAttribute("aria-pressed", String(lang === "en"));
    // re-render dinámicos visibles (resultado)
    if (!result.hidden) {
      renderResult(lastResult);
    }
    if (!progress.hidden) {
      updateProgressText();
    }
    if (!statsSection.hidden && lastStats) {
      renderStats(lastStats);
    }
  }

  $("langEs").addEventListener("click", () => setLang("es"));
  $("langEn").addEventListener("click", () => setLang("en"));

  function setLang(next) {
    if (lang === next) return;
    lang = next;
    try {
      localStorage.setItem("ypi-lang", lang);
    } catch {
      /* sin almacenamiento */
    }
    applyLang();
  }

  // tema: por defecto el del sistema, después lo que guardó el usuario
  const themeBtn = $("themeToggle");
  const themeIcon = themeBtn.querySelector("i");

  function applyTheme(theme) {
    document.documentElement.classList.toggle("light", theme === "light");
    themeIcon.className = theme === "light" ? "bi bi-sun" : "bi bi-moon-stars";
    try {
      localStorage.setItem("ypi-theme", theme);
    } catch {
      /* sin almacenamiento */
    }
  }

  let initialTheme = "dark";
  try {
    initialTheme =
      localStorage.getItem("ypi-theme") ||
      (window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark");
  } catch {
    /* ignora */
  }
  applyTheme(initialTheme);

  themeBtn.addEventListener("click", () => {
    const next = document.documentElement.classList.contains("light")
      ? "dark"
      : "light";
    applyTheme(next);
  });

  const preloader = $("preloader");
  window.addEventListener("load", () => {
    setTimeout(() => preloader.classList.add("done"), 600);
  });
  setTimeout(() => preloader.classList.add("done"), 2200);

  // sombra en el header al hacer scroll (estilo navbar de la referencia)
  const appHeader = document.querySelector(".app-header");
  const onScroll = () =>
    appHeader.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  function buildPills(list, active) {
    qualityPills.innerHTML = "";
    list.forEach((q) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = `pill${q === active ? " active" : ""}`;
      pill.dataset.q = String(q);
      pill.textContent = String(q);
      pill.addEventListener("click", () => {
        quality = q;
        qualityPills
          .querySelectorAll(".pill")
          .forEach((p) => p.classList.toggle("active", p === pill));
      });
      qualityPills.appendChild(pill);
    });
    const unit = document.createElement("span");
    unit.className = "pill-unit";
    unit.textContent = mode === "video" ? "p" : "kbps";
    qualityPills.appendChild(unit);
  }

  function setMode(next) {
    mode = next;
    quality = next === "video" ? 360 : 128;
    segBtns.forEach((btn) => {
      const active = btn.dataset.mode === next;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
    buildPills(next === "video" ? VIDEO_QUALITIES : AUDIO_QUALITIES, quality);
  }

  segBtns.forEach((btn) =>
    btn.addEventListener("click", () => setMode(btn.dataset.mode))
  );

  function toast(message, kind) {
    const el = document.createElement("div");
    el.className = `toast ${kind || "ok"}`;
    el.innerHTML = `<span class="t-icon">${kind === "err" ? "✕" : "✓"}</span><span>${escapeHtml(
      message
    )}</span>`;
    toasts.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity 0.3s ease";
      setTimeout(() => el.remove(), 320);
    }, 4200);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }
    return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }

  function formatDuration(seconds) {
    if (!seconds) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  // estadísticas de descargas (persistidas en SQLite en el servidor)
  let lastStats = null;

  async function loadStats() {
    try {
      const res = await fetch("/api/stats", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const json = await res.json();
      if (!json?.ok || !json.data) return;
      lastStats = json.data;
      renderStats(json.data);
    } catch {
      /* las estadísticas no son críticas */
    }
  }

  function fmtNumber(value) {
    return Number(value || 0).toLocaleString(lang === "en" ? "en-US" : "es-ES");
  }

  function renderStats(stats) {
    if (!stats) return;
    const targets = [
      ["statTotal", stats.total],
      ["statVideos", stats.videos],
      ["statAudios", stats.audios],
      ["statToday", stats.hoy],
    ];
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    statsSection.hidden = false;
    targets.forEach(([id, value]) => {
      const el = $(id);
      if (reduceMotion) {
        el.textContent = fmtNumber(value);
        el.dataset.count = String(value);
        return;
      }
      animateCount(el, value);
    });
  }

  function animateCount(el, target) {
    const from = Number(el.dataset.count || "0") || 0;
    const duration = 700;
    const start = performance.now();
    function step(now) {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = Math.round(from + (target - from) * eased);
      el.textContent = fmtNumber(value);
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        el.dataset.count = String(target);
      }
    }
    requestAnimationFrame(step);
  }

  function extractHint(input) {
    const patterns = [
      /youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/)([\w-]{11})/i,
      /youtu\.be\/([\w-]{11})/i,
      /[?&]v=([\w-]{11})/i,
      /^([\w-]{11})$/,
    ];
    return patterns.some((p) => p.test(input.trim()));
  }

  function setProgress(percent) {
    if (percent == null) return;
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    progressFill.style.width = `${clamped}%`;
    progressPct.textContent = `${clamped}%`;
  }

  let lastProgressStage = "download";
  let lastProgressPercent = 0;
  let lastStageLabel = "";

  function updateProgressText() {
    if (lastProgressPercent >= 0) {
      progressText.textContent =
        lastProgressStage === "convert"
          ? `${t("converting")} ${Math.round(lastProgressPercent)}%`
          : `${t("downloading")} ${Math.round(lastProgressPercent)}%`;
    } else if (lastStageLabel) {
      progressText.textContent = lastStageLabel;
    } else {
      progressText.textContent = t("processing");
    }
  }

  function handleProgressEvent(event) {
    if (event.type === "stage") {
      lastStageLabel = event.label || "";
      lastProgressPercent = -1;
      progressText.textContent = lastStageLabel || t("processing");
    } else if (event.type === "progress") {
      const percent = Number(event.percent);
      if (Number.isFinite(percent) && percent >= 0) {
        lastProgressPercent = percent;
        lastProgressStage = event.stage === "convert" ? "convert" : "download";
        setProgress(percent);
        updateProgressText();
      } else {
        lastProgressPercent = -1;
        lastStageLabel = event.label || "";
        progressText.textContent = lastStageLabel || t("downloading");
      }
    }
  }

  async function download() {
    const url = urlInput.value.trim();
    if (!url) {
      toast(t("noUrl"), "err");
      urlInput.focus();
      return;
    }
    if (!extractHint(url)) {
      toast(t("badUrl"), "err");
      urlInput.focus();
      return;
    }

    goBtn.disabled = true;
    urlInput.disabled = true;
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
      const res = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ url, quality, lang }),
      });

      const contentType = res.headers.get("content-type") || "";

      // los errores (400/429) llegan como JSON normal
      if (!contentType.includes("text/event-stream")) {
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || t("serverError"));
        }
        showResult(json.data);
        return;
      }

      // stream de eventos: progreso real de la descarga
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failure = null;
      let done = false;

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let index;
        while ((index = buffer.indexOf("\n\n")) !== -1) {
          const chunk = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          const line = chunk
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!line) continue;
          let event;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (event.type === "progress" || event.type === "stage") {
            handleProgressEvent(event);
          } else if (event.type === "done") {
            showResult(event.data);
            done = true;
          } else if (event.type === "error") {
            failure = event.message || t("serverError");
          }
        }
        if (done || failure) break;
      }
      if (failure) throw new Error(failure);
      if (!done) throw new Error(t("connectionClosed"));
    } catch (error) {
      toast(error.message || t("failed"), "err");
    } finally {
      goBtn.disabled = false;
      urlInput.disabled = false;
      progress.hidden = true;
      progressFill.style.width = "0%";
      progressPct.textContent = "0%";
      lastProgressPercent = -1;
      lastStageLabel = "";
    }
  }

  let lastResult = null;

  function renderResult(data) {
    const thumb = $("rThumb");
    const title = $("rTitle");
    const meta = $("rMeta");
    const chips = $("rChips");
    const link = $("rLink");
    const hint = $("rHint");

    if (data.miniatura) {
      thumb.alt = data.titulo || t("thumbAlt");
      thumb.style.display = "block";
      thumb.onerror = () => {
        // maxresdefault no siempre existe; caemos a hqdefault
        const src = thumb.src;
        if (src.includes("maxresdefault") && !thumb.dataset.fallback) {
          thumb.dataset.fallback = "1";
          thumb.src = src.replace("maxresdefault", "hqdefault");
        } else {
          thumb.style.display = "none";
        }
      };
      thumb.src = data.miniatura;
    } else {
      thumb.style.display = "none";
    }

    title.textContent = data.titulo || t("ready");

    meta.innerHTML = "";
    if (data.duracion) {
      const icon = document.createElement("i");
      icon.className = "bi bi-clock";
      meta.appendChild(icon);
      meta.appendChild(
        document.createTextNode(`${t("duration")} ${formatDuration(data.duracion)}`)
      );
    }

    chips.innerHTML = "";
    const labels = [
      { text: data.calidad, ok: true },
      { text: formatBytes(data.size), ok: false },
      { text: data.filename, ok: false },
    ];
    labels
      .filter((chip) => chip.text)
      .forEach((chip) => {
        const el = document.createElement("span");
        el.className = `chip${chip.ok ? " ok" : ""}`;
        el.textContent = chip.text;
        chips.appendChild(el);
      });

    link.value = data.downloadUrl;
    $("rDownload").href = data.downloadUrl;

    const seconds = data.expiraEn || 180;
    const mins = Math.max(1, Math.round(seconds / 60));
    const expiry =
      seconds < 3600
        ? t("expiresMin", { n: mins })
        : t("expiresHour", { n: Math.round(seconds / 3600) });
    hint.textContent = t("hint", { expiry });
  }

  function showResult(data) {
    lastResult = data;
    renderResult(data);
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    toast(t("doneToast"));
    loadStats();
  }

  $("rCopy").addEventListener("click", async () => {
    const link = $("rLink");
    try {
      await navigator.clipboard.writeText(link.value);
      toast(t("copied"));
    } catch {
      link.select();
      link.setSelectionRange(0, link.value.length);
      document.execCommand("copy");
      toast(t("copiedShort"));
    }
  });

  goBtn.addEventListener("click", download);
  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") download();
  });

  urlInput.addEventListener("paste", () => {
    setTimeout(() => {
      const value = urlInput.value.trim();
      if (value.includes("shorts/") && mode !== "video") {
        setMode("video");
      }
    }, 0);
  });

  applyLang();
  setMode("video");
  loadStats();
})();
