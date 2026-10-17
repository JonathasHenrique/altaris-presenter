import { store } from "./engine/state";

const liveTitle = document.getElementById("remote-live-title")!;
const liveText = document.getElementById("remote-live-text")!;
const nextText = document.getElementById("remote-next-text")!;

document.getElementById("btn-remote-next")?.addEventListener("click", () => store.sendCommand("next"));
document.getElementById("btn-remote-prev")?.addEventListener("click", () => store.sendCommand("prev"));

document.getElementById("btn-remote-clear")?.addEventListener("click", () => {
  store.setState({ isClearText: !store.getState().isClearText });
});

document.getElementById("btn-remote-blackout")?.addEventListener("click", () => {
  store.setState({ isBlackout: !store.getState().isBlackout });
});

store.subscribe((state) => {
  if (state.currentSlide) {
    liveTitle.textContent = state.currentSlide.title;
    liveText.textContent = state.isClearText ? "(Texto oculto)" : state.currentSlide.text;
  }
  nextText.textContent = state.nextSlide ? state.nextSlide.text : "Fim da apresentação";
});
