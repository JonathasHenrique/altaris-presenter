import { store } from "./engine/state";
import { SlideCompositor } from "./engine/compositor";
import { inTauri, tauriInvoke } from "./engine/server";

const canvas = document.getElementById("audience-canvas") as HTMLCanvasElement;
const compositor = new SlideCompositor(canvas, {
  layout: "full",
  showBackground: true,
  alphaChannel: false,
  isBlackout: false,
  isClearText: false
});

async function closeAudienceWindow() {
  if (inTauri()) {
    try {
      await tauriInvoke("toggle_audience_window", { monitorIndex: null });
      return;
    } catch {}
  }
  window.close();
}

document.getElementById("btn-aud-close")?.addEventListener("click", () => {
  void closeAudienceWindow();
});

document.getElementById("btn-aud-fullscreen")?.addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.().catch(() => {});
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.key === "F5") {
    e.preventDefault();
    void closeAudienceWindow();
  } else if (e.code === "KeyB" || e.key.toLowerCase() === "b") {
    e.preventDefault();
    store.sendCommand("toggle-blackout");
  } else if (e.code === "KeyC" || e.key.toLowerCase() === "c") {
    e.preventDefault();
    store.sendCommand("toggle-clear");
  } else if (e.code === "Space" || e.code === "ArrowRight") {
    e.preventDefault();
    store.sendCommand("next");
  } else if (e.code === "ArrowLeft" || e.code === "Backspace") {
    e.preventDefault();
    store.sendCommand("prev");
  }
});

// Auto-hide floating controls and cursor on inactivity (2.5s)
const floatingBar = document.getElementById("audience-floating-bar");
let hideTimeout: number | null = null;
let isHoveringBar = false;

floatingBar?.addEventListener("mouseenter", () => {
  isHoveringBar = true;
});
floatingBar?.addEventListener("mouseleave", () => {
  isHoveringBar = false;
  scheduleHide();
});

function scheduleHide() {
  if (hideTimeout !== null) {
    window.clearTimeout(hideTimeout);
  }
  hideTimeout = window.setTimeout(() => {
    if (!isHoveringBar) {
      floatingBar?.classList.remove("visible");
      document.body.classList.add("hide-cursor");
    }
  }, 2500);
}

function showControls() {
  document.body.classList.remove("hide-cursor");
  floatingBar?.classList.add("visible");
  scheduleHide();
}

window.addEventListener("mousemove", showControls);
window.addEventListener("mousedown", showControls);
window.addEventListener("touchstart", showControls);

// Initial trigger to fade out after launch
scheduleHide();

store.subscribe((state) => {
  compositor.setSlide(state.currentSlide);
  compositor.setOptions({
    isBlackout: state.isBlackout || !state.isLive,
    isClearText: state.isClearText,
    alertText: state.alertMessage,
    clockPosition: state.clockPosition,
    backgroundTheme: state.backgroundTheme,
    customBackgroundImage: state.customBackgroundImage,
    customBackgroundVideo: state.customBackgroundVideo,
    backgroundDimmer: state.backgroundDimmer,
    fontFamily: state.fontFamily,
    textColor: state.textColor,
    uppercaseLyrics: state.uppercaseLyrics,
    lowSpecMode: state.lowSpecMode,
    fontSizeScale: state.fontSizeScale,
    fontStyle: state.fontStyle,
    textShadowStyle: state.textShadowStyle,
    showSongTitle: state.showSongTitle,
    bibleReferenceFormat: state.bibleReferenceFormat
  });
});
