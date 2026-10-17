import { store } from "./engine/state";

const clockEl = document.getElementById("stage-clock")!;
const headerEl = document.getElementById("stage-slide-header")!;
const lyricsEl = document.getElementById("stage-lyrics")!;
const chordsEl = document.getElementById("stage-chords")!;
const nextEl = document.getElementById("stage-next")!;

// Update clock every second
setInterval(() => {
  const now = new Date();
  clockEl.textContent = now.toTimeString().split(" ")[0];
}, 1000);

store.subscribe((state) => {
  if (state.isBlackout || !state.isLive) {
    lyricsEl.textContent = "--- TELÃO EM BLACKOUT ---";
    lyricsEl.style.color = "#ef4444";
    chordsEl.textContent = "";
    return;
  }

  lyricsEl.style.color = "#ffffff";
  if (state.currentSlide) {
    headerEl.textContent = state.currentSlide.header || state.currentSlide.title;
    lyricsEl.textContent = state.isClearText ? "(Texto Oculto no Telão)" : state.currentSlide.text;
    chordsEl.textContent = state.currentSlide.chords || "";
    chordsEl.style.display = state.currentSlide.chords ? "block" : "none";
  } else {
    headerEl.textContent = "RETORNO DE PALCO";
    lyricsEl.textContent = "Aguardando próximo item...";
    chordsEl.textContent = "";
    chordsEl.style.display = "none";
  }

  if (state.nextSlide) {
    nextEl.textContent = `${state.nextSlide.header || state.nextSlide.title}: ${state.nextSlide.text.replace(/\\n/g, " ")}`;
  } else {
    nextEl.textContent = "Fim da apresentação / Próximo item não selecionado";
  }
});
