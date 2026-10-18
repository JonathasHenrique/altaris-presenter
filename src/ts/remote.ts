import { store } from "./engine/state";

const liveTitle = document.getElementById("remote-live-title")!;
const liveText = document.getElementById("remote-live-text")!;
const liveCounter = document.getElementById("remote-live-counter");
const nextText = document.getElementById("remote-next-text")!;
const slidesListEl = document.getElementById("remote-slides-list");
const playlistListEl = document.getElementById("remote-playlist-list");

const tabSlides = document.getElementById("rem-tab-slides");
const tabSongs = document.getElementById("rem-tab-songs");
const tabBible = document.getElementById("rem-tab-bible");
const tabStage = document.getElementById("rem-tab-stage");

const paneSlides = document.getElementById("rem-pane-slides");
const paneSongs = document.getElementById("rem-pane-songs");
const paneBible = document.getElementById("rem-pane-bible");
const paneStage = document.getElementById("rem-pane-stage");

function vibrate() {
  try {
    navigator.vibrate?.(25);
  } catch {}
}

function switchRemoteTab(tab: "slides" | "songs" | "bible" | "stage") {
  [tabSlides, tabSongs, tabBible, tabStage].forEach((b) => b?.classList.remove("btn-primary"));
  if (paneSlides) paneSlides.style.display = tab === "slides" ? "flex" : "none";
  if (paneSongs) paneSongs.style.display = tab === "songs" ? "flex" : "none";
  if (paneBible) paneBible.style.display = tab === "bible" ? "flex" : "none";
  if (paneStage) paneStage.style.display = tab === "stage" ? "flex" : "none";

  if (tab === "slides") tabSlides?.classList.add("btn-primary");
  if (tab === "songs") tabSongs?.classList.add("btn-primary");
  if (tab === "bible") tabBible?.classList.add("btn-primary");
  if (tab === "stage") tabStage?.classList.add("btn-primary");
}

tabSlides?.addEventListener("click", () => switchRemoteTab("slides"));
tabSongs?.addEventListener("click", () => switchRemoteTab("songs"));
tabBible?.addEventListener("click", () => switchRemoteTab("bible"));
tabStage?.addEventListener("click", () => switchRemoteTab("stage"));

document.getElementById("btn-remote-next")?.addEventListener("click", () => {
  vibrate();
  store.sendCommand("next");
});

document.getElementById("btn-remote-prev")?.addEventListener("click", () => {
  vibrate();
  store.sendCommand("prev");
});

document.getElementById("btn-remote-clear")?.addEventListener("click", () => {
  vibrate();
  store.setState({ isClearText: !store.getState().isClearText });
});

document.getElementById("btn-remote-blackout")?.addEventListener("click", () => {
  vibrate();
  store.setState({ isBlackout: !store.getState().isBlackout });
});

// Remote Song Search & Projection
const remSongInput = document.getElementById("rem-song-input") as HTMLInputElement | null;
document.getElementById("btn-rem-song-fire")?.addEventListener("click", () => {
  const q = remSongInput?.value.trim();
  if (q) {
    vibrate();
    store.sendCommand(`song:${q}`);
    if (remSongInput) remSongInput.value = "";
    switchRemoteTab("slides");
  }
});

remSongInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn-rem-song-fire")?.click();
});

document.querySelectorAll(".rem-quick-song").forEach((btn) => {
  btn.addEventListener("click", () => {
    const s = btn.getAttribute("data-song");
    if (s) {
      vibrate();
      store.sendCommand(`song:${s}`);
      switchRemoteTab("slides");
    }
  });
});

// Remote Bible Version Switcher (Instant, no menus!)
document.querySelectorAll(".rem-ver-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const ver = btn.getAttribute("data-ver");
    if (ver) {
      vibrate();
      document.querySelectorAll(".rem-ver-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      store.sendCommand(`bible-ver:${ver}`);
    }
  });
});

// Remote Bible Projection
const remBibleInput = document.getElementById("rem-bible-input") as HTMLInputElement | null;
document.getElementById("btn-rem-bible-fire")?.addEventListener("click", () => {
  const q = remBibleInput?.value.trim();
  if (q) {
    vibrate();
    store.sendCommand(`bible:${q}`);
    switchRemoteTab("slides");
  }
});

remBibleInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn-rem-bible-fire")?.click();
});

document.querySelectorAll(".rem-quick-verse").forEach((btn) => {
  btn.addEventListener("click", () => {
    const ref = btn.getAttribute("data-ref");
    if (ref) {
      vibrate();
      store.sendCommand(`bible:${ref}`);
      switchRemoteTab("slides");
    }
  });
});

// Remote Stage Communication & Public Alerts
const remStageMsg = document.getElementById("rem-stage-msg") as HTMLInputElement | null;
document.getElementById("btn-rem-stage-send")?.addEventListener("click", () => {
  vibrate();
  store.setState({ stageMessage: remStageMsg?.value.trim() || "" });
});

document.getElementById("btn-rem-stage-flash")?.addEventListener("click", () => {
  vibrate();
  store.setState({ stageFlash: true });
  setTimeout(() => store.setState({ stageFlash: false }), 2500);
});

document.getElementById("btn-rem-stage-clear")?.addEventListener("click", () => {
  if (remStageMsg) remStageMsg.value = "";
  store.setState({ stageMessage: "", stageFlash: false });
});

const remAlertMsg = document.getElementById("rem-alert-msg") as HTMLInputElement | null;
document.getElementById("btn-rem-alert-send")?.addEventListener("click", () => {
  vibrate();
  store.setState({ alertMessage: remAlertMsg?.value.trim() || "" });
});

document.getElementById("btn-rem-alert-clear")?.addEventListener("click", () => {
  if (remAlertMsg) remAlertMsg.value = "";
  store.setState({ alertMessage: "" });
});

// Hardware Volume / Arrow Keys navigation (Mobile Remote)
window.addEventListener("keydown", (e) => {
  if (document.activeElement?.tagName === "INPUT") return;
  if (e.key === "AudioVolumeUp" || e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
    e.preventDefault();
    store.sendCommand("next");
  } else if (e.key === "AudioVolumeDown" || e.key === "ArrowLeft" || e.key === "PageUp") {
    e.preventDefault();
    store.sendCommand("prev");
  }
});

store.subscribe((state) => {
  if (state.currentSlide) {
    liveTitle.textContent = state.currentSlide.header || state.currentSlide.title;
    liveText.textContent = state.isClearText ? "(Texto oculto no telão)" : state.currentSlide.text || "(Slide de Mídia Visual)";
  }
  nextText.textContent = state.nextSlide ? state.nextSlide.text || state.nextSlide.header : "Fim da apresentação";

  if (liveCounter && state.activeItemSlides?.length) {
    liveCounter.textContent = `Slide ${(state.liveSlideIndex ?? 0) + 1} / ${state.activeItemSlides.length}`;
  }

  // Sync Bible version pills
  if (state.activeBibleVersion) {
    document.querySelectorAll(".rem-ver-btn").forEach((b) => {
      if (b.getAttribute("data-ver") === state.activeBibleVersion) b.classList.add("active");
      else b.classList.remove("active");
    });
  }

  // Render clickable slides of the active item
  if (slidesListEl && Array.isArray(state.activeItemSlides)) {
    slidesListEl.innerHTML = "";
    state.activeItemSlides.forEach((sl) => {
      const btn = document.createElement("button");
      const isLive = sl.index === state.liveSlideIndex;
      btn.className = `rem-slide-item ${isLive ? "active" : ""}`;
      btn.innerHTML = `
        <div style="flex: 1; overflow: hidden;">
          <div style="font-size: 0.72rem; font-weight: 700; color: ${isLive ? "#f87171" : "#818cf8"}; margin-bottom: 2px;">${sl.header || `Slide ${sl.index + 1}`}</div>
          <div style="font-size: 0.82rem; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sl.text || "(Mídia Visual)"}</div>
        </div>
        ${isLive ? `<span style="font-size: 0.68rem; font-weight: 800; color: #ef4444;">● AR</span>` : `<span style="font-size: 0.75rem; color: #64748b;">▶</span>`}
      `;
      btn.addEventListener("click", () => {
        vibrate();
        store.sendCommand(`goto-slide:${sl.index}`);
      });
      slidesListEl.appendChild(btn);
    });
  }

  // Render clickable playlist items of today's worship service
  if (playlistListEl && Array.isArray(state.playlistSummary)) {
    playlistListEl.innerHTML = "";
    state.playlistSummary.forEach((item) => {
      const btn = document.createElement("button");
      const isSelected = item.index === state.activeItemIndex;
      const icon = item.type === "bible" ? "📖" : item.type === "media" ? "🖼️" : "🎵";
      btn.className = `rem-playlist-item ${isSelected ? "active" : ""}`;
      btn.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
          <span style="font-size: 1.1rem;">${icon}</span>
          <div style="overflow: hidden;">
            <div style="font-size: 0.86rem; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</div>
            <div style="font-size: 0.72rem; color: #94a3b8;">${item.slideCount} slides</div>
          </div>
        </div>
        <span style="font-size: 0.72rem; font-weight: 700; color: ${isSelected ? "#a5b4fc" : "#64748b"};">${isSelected ? "● ATIVO" : "Abrir ▶"}</span>
      `;
      btn.addEventListener("click", () => {
        vibrate();
        store.sendCommand(`select-item:${item.index}`);
        switchRemoteTab("slides");
      });
      playlistListEl.appendChild(btn);
    });
  }
});

