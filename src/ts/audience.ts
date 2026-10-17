import { store } from "./engine/state";
import { SlideCompositor } from "./engine/compositor";

const canvas = document.getElementById("audience-canvas") as HTMLCanvasElement;
const compositor = new SlideCompositor(canvas, {
  layout: "full",
  showBackground: true,
  alphaChannel: false,
  isBlackout: false,
  isClearText: false
});

store.subscribe((state) => {
  compositor.setSlide(state.currentSlide);
  compositor.setOptions({
    isBlackout: state.isBlackout || !state.isLive,
    isClearText: state.isClearText,
    alertText: state.alertMessage
  });
});
