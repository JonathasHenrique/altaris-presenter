import { store } from "./engine/state";
import { SlideCompositor } from "./engine/compositor";

const canvas = document.getElementById("stream-canvas") as HTMLCanvasElement;
const compositor = new SlideCompositor(canvas, {
  layout: "lowerThird",
  showBackground: false,
  alphaChannel: true, // Transparent for OBS!
  isBlackout: false,
  isClearText: false,
  obsTheme: "glass-pill"
});

const customStyleEl = document.getElementById("obs-custom-style") as HTMLStyleElement | null;
const customHtmlContainer = document.getElementById("obs-custom-html-container") as HTMLDivElement | null;

store.subscribe((state) => {
  if (customStyleEl && state.obsCustomCss !== undefined) {
    customStyleEl.textContent = state.obsCustomCss;
  }

  const isHidden = state.isBlackout || !state.isLive || state.isClearText || !state.currentSlide;

  if (state.obsTheme === "custom-html" && customHtmlContainer) {
    canvas.style.display = "none";
    if (isHidden) {
      customHtmlContainer.style.display = "none";
    } else {
      customHtmlContainer.style.display = "block";
      const sl = state.currentSlide!;
      const textVal = state.uppercaseLyrics ? sl.text.toUpperCase() : sl.text;
      const tpl = state.obsCustomHtml || `<div class="op-obs-card"><div class="op-obs-header">{{header}}</div><div class="op-obs-text">{{text}}</div></div>`;
      customHtmlContainer.innerHTML = tpl
        .replace(/\{\{title\}\}/g, sl.title || "")
        .replace(/\{\{header\}\}/g, sl.header || sl.title || "")
        .replace(/\{\{text\}\}/g, textVal)
        .replace(/\{\{chords\}\}/g, sl.chords || "");
    }
  } else {
    if (customHtmlContainer) customHtmlContainer.style.display = "none";
    canvas.style.display = "block";
  }

  compositor.setSlide(state.currentSlide);
  compositor.setOptions({
    isBlackout: state.isBlackout || !state.isLive,
    isClearText: state.isClearText,
    alertText: state.alertMessage,
    obsTheme: state.obsTheme,
    churchLogo: state.churchLogo,
    fontFamily: state.fontFamily,
    textColor: state.textColor,
    lowSpecMode: state.lowSpecMode,
    uppercaseLyrics: state.uppercaseLyrics,
    obsShape: state.obsShape,
    obsPosition: state.obsPosition,
    obsTextAlign: state.obsTextAlign,
    obsBgColor: state.obsBgColor,
    obsTextColor: state.obsTextColor,
    obsAccentColor: state.obsAccentColor,
    obsFontSize: state.obsFontSize,
    obsBold: state.obsBold,
    obsShowHeader: state.obsShowHeader
  });
});

