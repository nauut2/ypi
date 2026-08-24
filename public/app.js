/* YPi — download UI, ES/EN and local light/dark preference */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const I18N = {
    es: {
      metaTitle: "ypi",
      metaDesc: "Descarga media de YouTube en MP4 o MP3 sin registros ni archivos guardados.",
      mainNav: "Navegación principal",
      navHome: "Inicio",
      navDetails: "Detalles",
      language: "Idioma",
      themeToggle: "Cambiar entre tema claro y oscuro",
      profileRole: "YouTube downloader",
      profileDescription: "Descarga audio y video con una interfaz simple, rápida y sin registros.",
      formatsLabel: "Formatos disponibles",
      online: "En línea",
      downloadTitle: "Descargar",
      urlLabel: "ENLACE DE YOUTUBE",
      urlPlaceholder: "https://youtube.com/watch?v=…",
      paste: "Pegar",
      pasteTitle: "Pegar desde el portapapeles",
      formatLabel: "FORMATO",
      qualityLabel: "CALIDAD",
      video: "Video",
      audio: "Audio",
      downloadCaption: "Enlace temporal · sin registros · sin archivos guardados",
      downloadBtn: "Descargar",
      loadingTitle: "Preparando descarga",
      working: "Procesando",
      processing: "Buscando un enlace disponible…",
      loaderHint: "No cierres esta página mientras preparamos los detalles.",
      detailsTitle: "Detalles",
      available: "Disponible",
      thumbnailAlt: "Miniatura del video",
      downloadLink: "ENLACE DE DESCARGA",
      copy: "Copiar",
      copyTitle: "Copiar enlace",
      downloadFile: "Descargar archivo",
      footer: "media downloader",
      noUrl: "Pega primero un enlace de YouTube.",
      badUrl: "Ese enlace no parece ser una URL válida de YouTube.",
      serverError: "El servidor no pudo completar la solicitud.",
      connectionClosed: "La conexión se cerró antes de terminar.",
      failed: "No se pudo preparar la descarga.",
      clipboardUnavailable: "No se pudo leer el portapapeles. Pega el enlace manualmente.",
      pasted: "Enlace pegado.",
      copied: "Enlace copiado al portapapeles.",
      copiedShort: "Enlace copiado.",
      preparingVideo: "Preparando MP4 {q}p…",
      preparingAudio: "Preparando MP3 {q} kbps…",
      downloading: "Preparando enlace de descarga…",
      duration: "Duración {value}",
      expiresMin: "expira en {n} min",
      expiresHour: "expira en {n} h",
      hint: "Enlace temporal: {expiry} · el archivo no queda guardado",
      doneToast: "Listo. Tu enlace de descarga ya está disponible.",
    },
    en: {
      metaTitle: "ypi",
      metaDesc: "Download YouTube media in MP4 or MP3 with no sign-up and no stored files.",
      mainNav: "Main navigation",
      navHome: "Home",
      navDetails: "Details",
      language: "Language",
      themeToggle: "Switch between light and dark theme",
      profileRole: "YouTube downloader",
      profileDescription: "Download audio and video with a simple, fast, sign-up-free interface.",
      formatsLabel: "Available formats",
      online: "Online",
      downloadTitle: "Download",
      urlLabel: "YOUTUBE LINK",
      urlPlaceholder: "https://youtube.com/watch?v=…",
      paste: "Paste",
      pasteTitle: "Paste from clipboard",
      formatLabel: "FORMAT",
      qualityLabel: "QUALITY",
      video: "Video",
      audio: "Audio",
      downloadCaption: "Temporary link · no sign-up · no stored files",
      downloadBtn: "Download",
      loadingTitle: "Preparing download",
      working: "Working",
      processing: "Finding an available link…",
      loaderHint: "Do not close this page while we prepare the details.",
      detailsTitle: "Details",
      available: "Available",
      thumbnailAlt: "Video thumbnail",
      downloadLink: "DOWNLOAD LINK",
      copy: "Copy",
      copyTitle: "Copy link",
      downloadFile: "Download file",
      footer: "media downloader",
      noUrl: "Paste a YouTube link first.",
      badUrl: "That does not look like a valid YouTube URL.",
      serverError: "The server could not complete the request.",
      connectionClosed: "The connection closed before completion.",
      failed: "The download could not be prepared.",
      clipboardUnavailable: "The clipboard could not be read. Please paste the link manually.",
      pasted: "Link pasted.",
      copied: "Link copied to your clipboard.",
      copiedShort: "Link copied.",
      preparingVideo: "Preparing MP4 {q}p…",
      preparingAudio: "Preparing MP3 {q} kbps…",
      downloading: "Preparing download link…",
      duration: "Duration {value}",
      expiresMin: "expires in {n} min",
      expiresHour: "expires in {n} h",
      hint: "Temporary link: {expiry} · the file is never stored",
      doneToast: "Done. Your download link is now available.",
    },
  };

  const VIDEO_QUALITIES = [360, 480, 720, 1080];
  const AUDIO_QUALITIES = [128, 96, 256, 320];

  const urlInput = $("url");
  const pasteButton = $("paste");
  const goButton = $("go");
  const formatButtons = Array.from(document.querySelectorAll(".format-btn"));
  const qualityPills = $("qualityPills");
  const progress = $("progress");
  const progressText = $("progressText");
  const progressPct = $("progressPct");
  const result = $("result");
  const toasts = $("toasts");
  const themeToggle = $("themeToggle");
  const themeIcon = $("themeIcon");

  let lang = getLanguage();
  let mode = "video";
  let quality = 360;
  let lastResult = null;
  let currentStage = "";

  function getLanguage() {
    try {
      const stored = localStorage.getItem("ypi-lang");
      if (stored === "es" || stored === "en") return stored;
    } catch {
      // Storage is optional.
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

    const esButton = $("langEs");
    const enButton = $("langEn");
    esButton.classList.toggle("active", lang === "es");
    enButton.classList.toggle("active", lang === "en");
    esButton.setAttribute("aria-pressed", String(lang === "es"));
    enButton.setAttribute("aria-pressed", String(lang === "en"));

    if (lastResult) renderResult(lastResult);
    if (!progress.hidden && currentStage) progressText.textContent = currentStage;
  }

  function setLanguage(next) {
    if (next !== "es" && next !== "en" || next === lang) return;
    lang = next;
    try {
      localStorage.setItem("ypi-lang", lang);
    } catch {
      // Change remains active for this visit.
    }
    applyLanguage();
  }

  function getTheme() {
    try {
      const stored = localStorage.getItem("ypi-theme");
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      // Storage is optional.
    }
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function renderThemeIcon(theme) {
    if (!themeIcon) return;
    themeIcon.innerHTML = theme === "light"
      ? '<path d="M20 12.8A8 8 0 1 1 11.2 4 6.2 6.2 0 0 0 20 12.8Z" />'
      : '<circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />';
  }

  function applyTheme(theme) {
    const isLight = theme === "light";
    document.documentElement.classList.toggle("light", isLight);
    themeToggle?.setAttribute("aria-pressed", String(isLight));
    renderThemeIcon(theme);
    window.YPi3DLoader?.setTheme?.();
    try {
      localStorage.setItem("ypi-theme", theme);
    } catch {
      // The selected theme still applies for the current visit.
    }
  }

  function buildQualityPills(values, activeValue) {
    qualityPills.innerHTML = "";
    values.forEach((value) => {
      const button = document.createElement("button");
      const selected = value === activeValue;
      button.type = "button";
      button.className = `quality-pill${selected ? " active" : ""}`;
      button.textContent = String(value);
      button.setAttribute("aria-pressed", String(selected));
      button.setAttribute("aria-label", mode === "video" ? `${value}p` : `${value} kbps`);
      button.addEventListener("click", () => {
        quality = value;
        qualityPills.querySelectorAll(".quality-pill").forEach((item) => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
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
      button.classList.toggle("active", selected);
      button.setAttribute("aria-selected", String(selected));
    });
    buildQualityPills(mode === "video" ? VIDEO_QUALITIES : AUDIO_QUALITIES, quality);
  }

  function toast(message, type = "ok") {
    const node = document.createElement("div");
    node.className = `toast${type === "error" ? " error" : ""}`;
    node.innerHTML = `<span class="toast-mark">${type === "error" ? "×" : "✓"}</span><span>${escapeHtml(message)}</span>`;
    toasts.appendChild(node);
    window.setTimeout(() => {
      node.style.opacity = "0";
      node.style.transform = "translateY(6px)";
      node.style.transition = "opacity .18s ease, transform .18s ease";
      window.setTimeout(() => node.remove(), 200);
    }, 4300);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function validYoutubeLink(value) {
    const text = value.trim();
    return [
      /youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/|v\/)([\w-]{11})/i,
      /youtu\.be\/([\w-]{11})/i,
      /[?&]v=([\w-]{11})/i,
      /^([\w-]{11})$/,
    ].some((pattern) => pattern.test(text));
  }

  function formatDuration(value) {
    const seconds = Number(value || 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return "";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = Math.floor(seconds % 60);
    const pad = (number) => String(number).padStart(2, "0");
    return hours ? `${hours}:${pad(minutes)}:${pad(remainder)}` : `${minutes}:${pad(remainder)}`;
  }

  function showLoader(label) {
    currentStage = label || t("processing");
    result.hidden = true;
    progress.hidden = false;
    progressText.textContent = currentStage;
    progressPct.textContent = "···";
    window.YPi3DLoader?.start?.();
  }

  function hideLoader() {
    window.YPi3DLoader?.stop?.();
    progress.hidden = true;
    currentStage = "";
  }

  function handleEvent(event) {
    if (event.type === "stage") {
      currentStage = event.label || t("processing");
      progressText.textContent = currentStage;
      progressPct.textContent = "···";
      return;
    }
    if (event.type === "progress") {
      const percentage = Number(event.percent);
      if (Number.isFinite(percentage) && percentage >= 0) {
        progressPct.textContent = `${Math.round(Math.min(100, percentage))}%`;
        progressText.textContent = event.stage === "download" ? t("downloading") : t("processing");
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
    if (!validYoutubeLink(url)) {
      toast(t("badUrl"), "error");
      urlInput.focus();
      return;
    }

    goButton.disabled = true;
    urlInput.disabled = true;
    pasteButton.disabled = true;
    showLoader(mode === "video" ? t("preparingVideo", { q: quality }) : t("preparingAudio", { q: quality }));

    try {
      const response = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream, application/json",
        },
        body: JSON.stringify({ url, quality, lang }),
      });
      const type = response.headers.get("content-type") || "";

      if (!type.includes("text/event-stream")) {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) throw new Error(payload?.error || t("serverError"));
        showResult(payload.data);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error(t("connectionClosed"));
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      let failure = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let split = buffer.indexOf("\n\n");
        while (split !== -1) {
          const chunk = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const line = chunk.split("\n").find((entry) => entry.startsWith("data: "));
          if (line) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "stage" || event.type === "progress") handleEvent(event);
              if (event.type === "done") {
                showResult(event.data);
                done = true;
              }
              if (event.type === "error") failure = event.message || t("serverError");
            } catch {
              // Ignore malformed SSE entries and continue parsing the stream.
            }
          }
          if (done || failure) break;
          split = buffer.indexOf("\n\n");
        }
        if (done || failure) break;
      }
      if (failure) throw new Error(failure);
      if (!done) throw new Error(t("connectionClosed"));
    } catch (error) {
      toast(error instanceof Error ? error.message : t("failed"), "error");
    } finally {
      hideLoader();
      goButton.disabled = false;
      urlInput.disabled = false;
      pasteButton.disabled = false;
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
      thumb.dataset.fallback = "";
      thumb.alt = data.titulo || t("thumbnailAlt");
      thumb.onerror = () => {
        if (!thumb.dataset.fallback && thumb.src.includes("maxresdefault")) {
          thumb.dataset.fallback = "1";
          thumb.src = thumb.src.replace("maxresdefault", "hqdefault");
        } else {
          thumb.style.display = "none";
        }
      };
      thumb.src = data.miniatura;
    } else {
      thumb.style.display = "none";
    }

    title.textContent = data.titulo || t("detailsTitle");
    const duration = formatDuration(data.duracion);
    meta.textContent = [data.canal, duration ? t("duration", { value: duration }) : ""].filter(Boolean).join(" · ");

    chips.innerHTML = "";
    [
      { text: data.calidad, ok: true },
      { text: data.filename, ok: false },
    ]
      .filter((item) => item.text)
      .forEach((item) => {
        const chip = document.createElement("span");
        chip.className = `chip${item.ok ? " ok" : ""}`;
        chip.textContent = item.text;
        chips.appendChild(chip);
      });

    link.value = data.downloadUrl || "";
    $("rDownload").href = data.downloadUrl || "#";
    const seconds = Number(data.expiraEn || 120);
    const expiry = seconds < 3600
      ? t("expiresMin", { n: Math.max(1, Math.round(seconds / 60)) })
      : t("expiresHour", { n: Math.round(seconds / 3600) });
    hint.textContent = t("hint", { expiry });
  }

  function showResult(data) {
    lastResult = data;
    renderResult(data);
    result.hidden = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    result.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    toast(t("doneToast"));
  }

  $("langEs").addEventListener("click", () => setLanguage("es"));
  $("langEn").addEventListener("click", () => setLanguage("en"));
  themeToggle?.addEventListener("click", () => {
    applyTheme(document.documentElement.classList.contains("light") ? "dark" : "light");
  });
  formatButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));

  pasteButton.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      urlInput.value = text.trim();
      urlInput.focus();
      toast(t("pasted"));
    } catch {
      toast(t("clipboardUnavailable"), "error");
      urlInput.focus();
    }
  });

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

  goButton.addEventListener("click", requestDownload);
  urlInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") requestDownload();
  });
  urlInput.addEventListener("paste", () => {
    window.setTimeout(() => {
      if (urlInput.value.includes("shorts/") && mode !== "video") setMode("video");
    }, 0);
  });

  applyTheme(getTheme());
  applyLanguage();
  setMode("video");
})();
