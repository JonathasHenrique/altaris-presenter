// Estado ao vivo compartilhado entre TODAS as telas.
// Transporte: WebSocket do servidor Rust (funciona em celular e OBS).
// Fallback: BroadcastChannel (somente janelas do mesmo navegador, p.ex. dev no Chrome).
import { getServerInfo } from "./server";

export interface SlideElementParagraph {
  text: string;
  align?: "left" | "center" | "right";
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface SlideElement {
  id: string;
  type: "text" | "image" | "shape";
  x: number; // 0 a 100%
  y: number; // 0 a 100%
  w: number; // 0 a 100%
  h: number; // 0 a 100%
  imageUrl?: string;
  shapeType?: string;
  bgColor?: string;
  borderColor?: string;
  borderRadius?: number;
  text?: string;
  paragraphs?: SlideElementParagraph[];
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
}

export interface SlideLayout {
  bgImage?: string;
  bgColor?: string;
  elements: SlideElement[];
}

export interface Slide {
  id: string;
  title: string;
  header: string;
  text: string;
  chords?: string;
  category: "intro" | "verse" | "chorus" | "bridge" | "ending" | "bible" | "alert" | "media";
  mediaUrl?: string;
  mediaType?: "image" | "video";
  auditStatus?: "ok" | "warning" | "overflow";
  auditIssue?: string;
  background: {
    type: "video" | "gradient" | "color" | "shader" | "image";
    value: string;
  };
  layout?: SlideLayout;
}

export interface PlaylistItem {
  id: string;
  title: string;
  type: "song" | "bible" | "alert" | "media";
  slides: Slide[];
  author?: string;
  key?: string;
  presentationPath?: string;
  auditReport?: any;
  originalFile?: File;
}

export interface RemotePlaylistSummary {
  index: number;
  id: string;
  title: string;
  type: string;
  slideCount: number;
}

export interface RemoteSlideSummary {
  index: number;
  header: string;
  text: string;
  category: string;
}

export interface AppState {
  currentSlide: Slide | null;
  nextSlide: Slide | null;
  isLive: boolean;
  isBlackout: boolean;
  isClearText: boolean;
  isLogo: boolean;
  churchLogo: string | null;
  churchLogoName: string | null;
  obsTheme: "glass-pill" | "clean-minimal" | "full-width" | "bible-box" | "custom-html";
  obsCustomCss: string;
  obsCustomHtml: string;
  // OBS Visual Customization
  obsShape: "pill" | "card" | "full-width" | "minimal";
  obsPosition: "bottom" | "top";
  obsTextAlign: "center" | "left";
  obsBgColor: string;
  obsTextColor: string;
  obsAccentColor: string;
  obsFontSize: "normal" | "large" | "huge";
  obsBold: boolean;
  obsShowHeader: boolean;

  clockPosition: "none" | "topRight" | "bottomRight" | "bottomLeft";
  backgroundTheme: "nebula" | "worship-gold" | "royal-blue" | "emerald-calm" | "crimson-cross" | "solid-dark" | "motion-loop-1" | "motion-loop-2" | "motion-loop-3" | "custom-image" | "custom-video";
  customBackgroundImage: string | null;
  customBackgroundImageName: string | null;
  customBackgroundVideo: string | null;
  customBackgroundVideoName: string | null;
  backgroundDimmer: number;
  fontFamily: string;
  textColor: string;
  uppercaseLyrics: boolean;
  lowSpecMode: boolean;
  lockToCurrentItem: boolean;

  // Telão / Audience Typography & Layout Preferences
  fontSizeScale: "normal" | "large" | "max";
  fontStyle: "normal" | "bold" | "italic" | "boldItalic";
  textShadowStyle: "soft" | "outline" | "none";
  showSongTitle: boolean;
  bibleReferenceFormat: "header" | "footer" | "inline";

  // Sorteios & Dinâmicas (Raffle System)
  raffleMode: "numbers" | "names";
  raffleMinNumber: number;
  raffleMaxNumber: number;
  raffleNoRepeat: boolean;
  raffleNames: string[];
  raffleDrawnNames: string[];
  raffleDrawnNumbers: number[];
  raffleLastWinner: string | null;

  alertMessage: string;
  alertCountdown: number | null;
  stageMessage: string;
  stageFlash: boolean;
  activeKeyOffset: number;
  activeBibleVersion: string;
  activeItemIndex: number;
  liveSlideIndex: number;
  playlistSummary: RemotePlaylistSummary[];
  activeItemSlides: RemoteSlideSummary[];
  screenLooks: {
    audience: { showBackground: boolean; showText: boolean; layout: "full" | "lowerThird" };
    stage: { showChords: boolean; showNext: boolean; showClock: boolean; showCountdown: boolean };
    stream: { showBackground: boolean; layout: "lowerThird" | "full"; alphaChannel: boolean };
  };
}

export function buildObsCss(st: Partial<AppState>): string {
  const shape = st.obsShape || "pill";
  const pos = st.obsPosition || "bottom";
  const align = st.obsTextAlign || "center";
  const bg = st.obsBgColor || "rgba(10, 14, 24, 0.88)";
  const color = st.obsTextColor || "#ffffff";
  const accent = st.obsAccentColor || "#818cf8";
  const fontSize = st.obsFontSize === "huge" ? "46px" : st.obsFontSize === "normal" ? "30px" : "38px";
  const headerSize = st.obsFontSize === "huge" ? "22px" : st.obsFontSize === "normal" ? "16px" : "19px";
  const weight = st.obsBold === false ? "500" : "700";
  const posCss = pos === "top" ? "top: 40px; bottom: auto;" : "bottom: 48px; top: auto;";

  let shapeCss = "";
  if (shape === "pill") {
    shapeCss = `width: auto;
  min-width: 540px;
  max-width: 1540px;
  border-radius: 9999px;
  padding: 18px 46px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
  background: ${bg};`;
  } else if (shape === "card") {
    shapeCss = `width: 82vw;
  max-width: 1480px;
  border-radius: 18px;
  padding: 22px 36px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-left: 6px solid ${accent};
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75);
  background: ${bg};`;
  } else if (shape === "full-width") {
    shapeCss = `width: 100vw;
  max-width: 100vw;
  left: 0 !important;
  transform: none !important;
  bottom: 0 !important;
  border-radius: 0;
  padding: 20px 48px;
  border-top: 3px solid ${accent};
  background: ${bg};
  box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.8);`;
  } else if (shape === "minimal") {
    shapeCss = `width: 86vw;
  max-width: 1540px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 10px 20px;`;
  }

  return `.op-obs-card {
  position: fixed;
  ${posCss}
  left: 50%;
  transform: translateX(-50%);
  backdrop-filter: blur(16px);
  color: ${color};
  font-family: Inter, system-ui, sans-serif;
  text-align: ${align};
  box-sizing: border-box;
  ${shapeCss}
}
.op-obs-header {
  font-size: ${headerSize};
  font-weight: 700;
  color: ${accent};
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 6px;
  display: ${st.obsShowHeader === false ? "none" : "block"};
}
.op-obs-text {
  font-size: ${fontSize};
  font-weight: ${weight};
  line-height: 1.32;
  white-space: pre-line;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.85);
}`;
}

export function buildObsHtml(): string {
  return `<div class="op-obs-card">\n  <div class="op-obs-header">{{header}}</div>\n  <div class="op-obs-text">{{text}}</div>\n</div>`;
}

const DEFAULT_OBS_HTML = buildObsHtml();
const DEFAULT_OBS_CSS = buildObsCss({
  obsShape: "pill",
  obsPosition: "bottom",
  obsTextAlign: "center",
  obsBgColor: "rgba(10, 14, 24, 0.88)",
  obsTextColor: "#ffffff",
  obsAccentColor: "#818cf8",
  obsFontSize: "large",
  obsBold: true,
  obsShowHeader: true
});

const DEFAULT_STATE: AppState = {
  currentSlide: {
    id: "welcome-slide",
    title: "Boas-Vindas",
    header: "Altaris Presenter",
    text: "Sejam bem-vindos ao culto!\nOnde estiverem dois ou três reunidos em meu nome, ali estou eu.",
    category: "intro",
    background: { type: "shader", value: "nebula" }
  },
  nextSlide: null,
  isLive: true,
  isBlackout: false,
  isClearText: false,
  isLogo: false,
  churchLogo: null,
  churchLogoName: null,
  obsTheme: "glass-pill",
  obsCustomCss: DEFAULT_OBS_CSS,
  obsCustomHtml: DEFAULT_OBS_HTML,
  obsShape: "pill",
  obsPosition: "bottom",
  obsTextAlign: "center",
  obsBgColor: "rgba(10, 14, 24, 0.88)",
  obsTextColor: "#ffffff",
  obsAccentColor: "#818cf8",
  obsFontSize: "large",
  obsBold: true,
  obsShowHeader: true,
  clockPosition: "none",
  backgroundTheme: "nebula",
  customBackgroundImage: null,
  customBackgroundImageName: null,
  customBackgroundVideo: null,
  customBackgroundVideoName: null,
  backgroundDimmer: 0.45,
  fontFamily: "Inter, system-ui, sans-serif",
  textColor: "#ffffff",
  uppercaseLyrics: false,
  lowSpecMode: false,
  lockToCurrentItem: true,
  fontSizeScale: "large",
  fontStyle: "bold",
  textShadowStyle: "soft",
  showSongTitle: true,
  bibleReferenceFormat: "header",
  raffleMode: "numbers",
  raffleMinNumber: 1,
  raffleMaxNumber: 200,
  raffleNoRepeat: true,
  raffleNames: [
    "Lucas Gabriel",
    "Mariana Costa",
    "Pr. Carlos Eduardo",
    "Beatriz Oliveira",
    "Mateus Silveira",
    "Amanda Fernandes",
    "Gabriel Henrique",
    "Juliana Rocha",
    "Rafael Lima",
    "Camila Santos"
  ],
  raffleDrawnNames: [],
  raffleDrawnNumbers: [],
  raffleLastWinner: null,
  alertMessage: "",
  alertCountdown: null,
  stageMessage: "",
  stageFlash: false,
  activeKeyOffset: 0,
  activeBibleVersion: "acf",
  activeItemIndex: 0,
  liveSlideIndex: 0,
  playlistSummary: [],
  activeItemSlides: [],
  screenLooks: {
    audience: { showBackground: true, showText: true, layout: "full" },
    stage: { showChords: true, showNext: true, showClock: true, showCountdown: true },
    stream: { showBackground: false, layout: "lowerThird", alphaChannel: true }
  }
};

// Páginas servidas pelo Vite em desenvolvimento (não pelo servidor Rust).
const DEV_PORTS = new Set(["5173", "4173"]);

class StateManager {
  private state: AppState;
  private channel = new BroadcastChannel("open-presenter-sync");
  private cmdChannel = new BroadcastChannel("open-presenter-remote-cmd");
  private listeners = new Set<(state: AppState) => void>();
  private cmdListeners = new Set<(cmd: string) => void>();
  private ws: WebSocket | null = null;
  private retry = 0;

  constructor() {
    let parsed: Partial<AppState> = {};
    try {
      const saved = localStorage.getItem("open-presenter-state");
      if (saved) parsed = JSON.parse(saved);
    } catch {
      parsed = {};
    }
    this.state = { ...DEFAULT_STATE, ...parsed };

    this.channel.onmessage = (e) => {
      if (e.data?.type === "STATE_UPDATE" && !this.wsOpen()) {
        this.state = e.data.state;
        this.notify();
      }
    };
    this.cmdChannel.onmessage = (e) => {
      if (e.data?.command) this.cmdListeners.forEach((fn) => fn(e.data.command));
    };

    void this.connect();
  }

  private wsOpen(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private async endpoint(): Promise<string | null> {
    const info = await getServerInfo();
    if (info) return `ws://127.0.0.1:${info.port}/ws?pin=${info.pin}`;

    if (location.protocol.startsWith("http") && !DEV_PORTS.has(location.port)) {
      const q = new URLSearchParams(location.search).get("pin");
      if (q) sessionStorage.setItem("op-pin", q);
      const pin = sessionStorage.getItem("op-pin") ?? "";
      const proto = location.protocol === "https:" ? "wss" : "ws";
      return `${proto}://${location.host}/ws?pin=${encodeURIComponent(pin)}`;
    }
    return `ws://${location.hostname || "127.0.0.1"}:7878/ws`;
  }

  private async connect() {
    const url = await this.endpoint();
    if (!url) return;

    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      // Só a tela do operador empurra seu estado completo ao conectar.
      if (["/", "/index.html"].includes(location.pathname)) {
        const syncState = { ...this.state, customBackgroundVideo: null };
        ws.send(JSON.stringify({ type: "patch", patch: syncState }));
      }
    };
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === "patch" && m.patch) {
          this.state = { ...this.state, ...m.patch };
          this.notify();
        } else if (m.type === "cmd" && m.cmd) {
          this.cmdListeners.forEach((fn) => fn(m.cmd));
        }
      } catch {
        /* mensagem inválida ignorada */
      }
    };
    ws.onclose = () => {
      this.ws = null;
      const delay = Math.min(3000, 400 * 2 ** this.retry++);
      setTimeout(() => void this.connect(), delay);
    };
  }

  getState(): AppState {
    return this.state;
  }

  setState(partial: Partial<AppState>) {
    this.state = { ...this.state, ...partial };
    try {
      const persistable = { ...this.state, customBackgroundVideo: null };
      localStorage.setItem("open-presenter-state", JSON.stringify(persistable));
    } catch {
      /* armazenamento cheio: segue sem persistir */
    }
    if (this.wsOpen()) {
      const networkPatch = { ...partial };
      if (networkPatch.customBackgroundVideo && networkPatch.customBackgroundVideo.startsWith("blob:")) {
        // Blob URLs são locais da janela; mantém no broadcast local
      }
      this.ws!.send(JSON.stringify({ type: "patch", patch: networkPatch }));
    }
    this.channel.postMessage({ type: "STATE_UPDATE", state: this.state });
    this.notify();
  }

  /** Envia um comando (ex.: "next", "prev", "goto-slide:2", "select-item:1") para a tela do operador. */
  sendCommand(cmd: string) {
    if (this.wsOpen()) {
      this.ws!.send(JSON.stringify({ type: "cmd", cmd }));
    } else {
      this.cmdChannel.postMessage({ command: cmd });
      // Fallback HTTP direto para o servidor Rust (garante entrega no celular mesmo reconectando WS)
      fetch(`/api/cmd?c=${encodeURIComponent(cmd)}`).catch(() => {});
    }
  }

  onCommand(fn: (cmd: string) => void): () => void {
    this.cmdListeners.add(fn);
    return () => this.cmdListeners.delete(fn);
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn(this.state));
  }
}

export const store = new StateManager();

