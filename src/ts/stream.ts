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

store.subscribe((state) => {
  compositor.setSlide(state.currentSlide);
  compositor.setOptions({
    isBlackout: state.isBlackout || !state.isLive,
    isClearText: state.isClearText,
    alertText: state.alertMessage,
    obsTheme: state.obsTheme,
    churchLogo: state.churchLogo,
    lowSpecMode: state.lowSpecMode
  });
});
