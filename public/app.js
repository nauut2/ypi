/* YPi · Descargador de YouTube — lógica del cliente */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const urlInput = $("url");
  const goBtn = $("go");
  const segBtns = Array.from(document.querySelectorAll(".seg-btn"));
  const qualityPills = $("qualityPills");
  const qualityWrap = $("qualityWrap");
  const progress = $("progress");
  const progressText = $("progressText");
  const result = $("result");
  const toasts = $("toasts");

  const VIDEO_QUALITIES = [360, 720, 1080];
  const AUDIO_QUALITIES = [128, 96, 256, 320];

  let mode = "video"; // video | audio
  let quality = 360;

  /* ---------- Tema claro / oscuro ---------- */

  const themeBtn = $("themeToggle");
  const themeIcon = themeBtn.querySelector("i");

  function applyTheme(theme) {
    document.documentElement.classList.toggle("light", theme === "light");
    themeIcon.className =
      theme === "light" ? "bi bi-sun" : "bi bi-moon-stars";
    try {
      localStorage.setItem("ypi-theme", theme);
    } catch {
      /* sin almacenamiento: ignora */
    }
  }

  let savedTheme = "dark";
  try {
    savedTheme = localStorage.getItem("ypi-theme") || "dark";
  } catch {
    /* ignora */
  }
  applyTheme(savedTheme);

  themeBtn.addEventListener("click", () => {
    const next =
      document.documentElement.classList.contains("light") ? "dark" : "light";
    applyTheme(next);
  });

  /* ---------- Preloader ---------- */

  const preloader = $("preloader");
  window.addEventListener("load", () => {
    setTimeout(() => preloader.classList.add("done"), 600);
  });
  setTimeout(() => preloader.classList.add("done"), 2200);

  /* ---------- Toggle video / audio ---------- */

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

  /* ---------- Toasts ---------- */

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

  /* ---------- Utilidades ---------- */

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

  function extractHint(input) {
    const patterns = [
      /youtube\.com\/(?:watch\?.*?v=|shorts\/|embed\/|live\/)([\w-]{11})/i,
      /youtu\.be\/([\w-]{11})/i,
      /[?&]v=([\w-]{11})/i,
      /^([\w-]{11})$/,
    ];
    return patterns.some((p) => p.test(input.trim()));
  }

  /* ---------- Descarga ---------- */

  async function download() {
    const url = urlInput.value.trim();
    if (!url) {
      toast("Pega primero un enlace de YouTube.", "err");
      urlInput.focus();
      return;
    }
    if (!extractHint(url)) {
      toast("El enlace no parece ser de YouTube.", "err");
      urlInput.focus();
      return;
    }

    goBtn.disabled = true;
    urlInput.disabled = true;
    result.hidden = true;
    progress.hidden = false;
    progressText.textContent =
      mode === "video"
        ? `Convirtiendo a MP4 ${quality}p… puede tardar hasta un minuto.`
        : `Convirtiendo a MP3 ${quality} kbps… puede tardar unos segundos.`;

    try {
      const res = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, quality }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || "Error inesperado del servidor.");
      }

      showResult(json.data);
    } catch (error) {
      toast(error.message || "No se pudo completar la descarga.", "err");
    } finally {
      goBtn.disabled = false;
      urlInput.disabled = false;
      progress.hidden = true;
    }
  }

  /* ---------- Resultado ---------- */

  function showResult(data) {
    const thumb = $("rThumb");
    const title = $("rTitle");
    const meta = $("rMeta");
    const chips = $("rChips");
    const link = $("rLink");
    const hint = $("rHint");

    if (data.miniatura) {
      thumb.alt = data.titulo || "Miniatura";
      thumb.style.display = "block";
      thumb.onerror = () => {
        // Si pedimos maxresdefault y no existe, caemos a hqdefault (siempre disponible).
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

    title.textContent = data.titulo || "Descarga lista";

    meta.innerHTML = "";
    if (data.duracion) {
      const icon = document.createElement("i");
      icon.className = "bi bi-clock";
      meta.appendChild(icon);
      meta.appendChild(
        document.createTextNode(`Duración ${formatDuration(data.duracion)}`)
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

    const hours = Math.max(1, Math.round((data.expiraEn || 86400) / 3600));
    hint.textContent = `El enlace expira en ${hours} h · se guardó localmente en el servidor`;

    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    toast("Listo. Descarga tu archivo.");
  }

  $("rCopy").addEventListener("click", async () => {
    const link = $("rLink");
    try {
      await navigator.clipboard.writeText(link.value);
      toast("Enlace copiado al portapapeles.");
    } catch {
      link.select();
      link.setSelectionRange(0, link.value.length);
      document.execCommand("copy");
      toast("Enlace copiado.");
    }
  });

  /* ---------- Eventos ---------- */

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

  setMode("video");
})();
