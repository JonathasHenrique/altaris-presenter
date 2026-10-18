import { store } from "./engine/state";
import { inTauri, tauriInvoke } from "./engine/server";

const clockEl = document.getElementById("stage-clock")!;
const headerEl = document.getElementById("stage-slide-header")!;
const lyricsEl = document.getElementById("stage-lyrics")!;
const chordsEl = document.getElementById("stage-chords")!;
const nextEl = document.getElementById("stage-next")!;
const cpBannerEl = document.getElementById("stage-cp-banner");

function updateClock() {
  const now = new Date();
  clockEl.textContent = now.toTimeString().split(" ")[0];
}
updateClock();
setInterval(updateClock, 1000);

async function closeStageWindow() {
  if (inTauri()) {
    try {
      await tauriInvoke("toggle_stage_window", { monitorIndex: null });
      return;
    } catch {}
  }
  window.close();
}

document.getElementById("btn-stage-close")?.addEventListener("click", () => {
  void closeStageWindow();
});

document.getElementById("btn-stage-fullscreen")?.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === "F6") {
    e.preventDefault();
    void closeStageWindow();
  }
});

store.subscribe((state) => {
  if (cpBannerEl) {
    if (state.stageMessage && state.stageMessage.trim().length > 0) {
      cpBannerEl.style.display = "block";
      cpBannerEl.textContent = `💬 PALCO: ${state.stageMessage}`;
    } else {
      cpBannerEl.style.display = "none";
      cpBannerEl.textContent = "";
    }
  }

  if (state.stageFlash) {
    document.body.classList.remove("flash-attention");
    void document.body.offsetWidth;
    document.body.classList.add("flash-attention");
  } else {
    document.body.classList.remove("flash-attention");
  }

  if (state.isBlackout || !state.isLive) {
    lyricsEl.textContent = "--- TELÃO EM BLACKOUT ---";
    lyricsEl.style.color = "#ef4444";
    chordsEl.textContent = "";
    chordsEl.style.display = "none";
    return;
  }

  lyricsEl.style.color = "#ffffff";
  if (state.currentSlide) {
    headerEl.textContent = state.currentSlide.header || state.currentSlide.title;
    const rawText = state.uppercaseLyrics ? state.currentSlide.text.toUpperCase() : state.currentSlide.text;
    lyricsEl.textContent = state.isClearText ? "(Texto Oculto no Telão)" : rawText;
    chordsEl.textContent = state.currentSlide.chords || "";
    chordsEl.style.display = state.currentSlide.chords ? "block" : "none";
  } else {
    headerEl.textContent = "RETORNO DE PALCO";
    lyricsEl.textContent = "Aguardando próximo item...";
    chordsEl.textContent = "";
    chordsEl.style.display = "none";
  }

  if (state.nextSlide) {
    nextEl.textContent = `${state.nextSlide.header || state.nextSlide.title}: ${state.nextSlide.text.replace(/\n/g, " ")}`;
  } else {
    nextEl.textContent = "Fim da apresentação / Próximo item não selecionado";
  }
});
