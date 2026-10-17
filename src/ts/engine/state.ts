// Estado ao vivo compartilhado entre TODAS as telas.
// Transporte: WebSocket do servidor Rust (funciona em celular e OBS).
// Fallback: BroadcastChannel (somente janelas do mesmo navegador, p.ex. dev no Chrome).
import { getServerInfo, inTauri } from "./server";

export interface Slide {
  id: string;
  title: string;
  header: string;
  text: string;
  chords?: string;
  category: "intro" | "verse" | "chorus" | "bridge" | "ending" | "bible" | "alert";
  background: {
    type: "video" | "gradient" | "color" | "shader";
    value: string;
  };
}

export interface PlaylistItem {
  id: string;
  title: string;
  type: "song" | "bible" | "alert" | "media";
  slides: Slide[];
  author?: string;
  key?: string;
}

export interface AppState {
  currentSlide: Slide | null;
  nextSlide: Slide | null;
  isLive: boolean;
  isBlackout: boolean;
  isClearText: boolean;
  isLogo: boolean;
  churchLogo: string | null;
  obsTheme: "glass-pill" | "clean-minimal" | "full-width" | "bible-box";
  clockPosition: "none" | "topRight" | "bottomRight" | "bottomLeft";
  lowSpecMode: boolean;
  alertMessage: string;
  alertCountdown: number | null;
  activeKeyOffset: number;
  screenLooks: {
    audience: { showBackground: boolean; showText: boolean; layout: "full" | "lowerThird" };
    stage: { showChords: boolean; showNext: boolean; showClock: boolean; showCountdown: boolean };
    stream: { showBackground: boolean; layout: "lowerThird" | "full"; alphaChannel: boolean };
  };
}

const DEFAULT_STATE: AppState = {
  currentSlide: {
    id: "welcome-slide",
    title: "Boas-Vindas",
    header: "OpenPresenter",
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
  obsTheme: "glass-pill",
  clockPosition: "none",
  lowSpecMode: false,
  alertMessage: "",
  alertCountdown: null,
  activeKeyOffset: 0,
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
    const saved = localStorage.getItem("open-presenter-state");
    this.state = saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : DEFAULT_STATE;

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
    if (inTauri()) return null;

    if (location.protocol.startsWith("http") && !DEV_PORTS.has(location.port)) {
      const q = new URLSearchParams(location.search).get("pin");
      if (q) sessionStorage.setItem("op-pin", q);
      const pin = sessionStorage.getItem("op-pin") ?? "";
      const proto = location.protocol === "https:" ? "wss" : "ws";
      return `${proto}://${location.host}/ws?pin=${encodeURIComponent(pin)}`;
    }
    return null;
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
        ws.send(JSON.stringify({ type: "patch", patch: this.state }));
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
      const delay = Math.min(5000, 500 * 2 ** this.retry++);
      setTimeout(() => void this.connect(), delay);
    };
  }

  getState(): AppState {
    return this.state;
  }

  setState(partial: Partial<AppState>) {
    this.state = { ...this.state, ...partial };
    try {
      localStorage.setItem("open-presenter-state", JSON.stringify(this.state));
    } catch {
      /* armazenamento cheio: segue sem persistir */
    }
    if (this.wsOpen()) {
      this.ws!.send(JSON.stringify({ type: "patch", patch: partial }));
    } else {
      this.channel.postMessage({ type: "STATE_UPDATE", state: this.state });
    }
    this.notify();
  }

  /** Envia um comando (ex.: "next", "prev") para a tela do operador. */
  sendCommand(cmd: string) {
    if (this.wsOpen()) this.ws!.send(JSON.stringify({ type: "cmd", cmd }));
    else this.cmdChannel.postMessage({ command: cmd });
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
