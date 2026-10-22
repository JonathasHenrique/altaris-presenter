// Altaris Presenter Compositor
// Desenha sempre em um espaço virtual 1920x1080 e escala para o canvas real,
// com quebra de linha e ajuste automático de fonte (auto-fit).
import { Slide, SlideLayout } from "./state";

export interface RenderOptions {
  layout: "full" | "lowerThird";
  showBackground: boolean;
  alphaChannel: boolean;
  isBlackout?: boolean;
  isClearText?: boolean;
  alertText?: string;
  obsTheme?: "glass-pill" | "clean-minimal" | "full-width" | "bible-box" | "custom-html";
  churchLogo?: string | null;
  lowSpecMode?: boolean;
  clockPosition?: "none" | "topRight" | "bottomRight" | "bottomLeft";
  backgroundTheme?: "nebula" | "worship-gold" | "royal-blue" | "emerald-calm" | "crimson-cross" | "solid-dark" | "motion-loop-1" | "motion-loop-2" | "motion-loop-3" | "custom-image" | "custom-video";
  customBackgroundImage?: string | null;
  customBackgroundVideo?: string | null;
  backgroundDimmer?: number;
  fontFamily?: string;
  textColor?: string;
  uppercaseLyrics?: boolean;

  // Telão / Audience Typography & Layout Preferences
  fontSizeScale?: "normal" | "large" | "max";
  fontStyle?: "normal" | "bold" | "italic" | "boldItalic";
  textShadowStyle?: "soft" | "outline" | "none";
  showSongTitle?: boolean;
  bibleReferenceFormat?: "header" | "footer" | "inline";

  // OBS Visual Customization
  obsShape?: "pill" | "card" | "full-width" | "minimal";
  obsPosition?: "bottom" | "top";
  obsTextAlign?: "center" | "left";
  obsBgColor?: string;
  obsTextColor?: string;
  obsAccentColor?: string;
  obsFontSize?: "normal" | "large" | "huge";
  obsBold?: boolean;
  obsShowHeader?: boolean;
}


function resolveVideoSrc(theme?: string, customVid?: string | null): string | null {
  const isHttp = typeof window !== "undefined" && window.location.protocol.startsWith("http");
  const base = isHttp ? "/data/videos/" : "./data/videos/";
  if (theme === "motion-loop-1") return `${base}bg1.mp4`;
  if (theme === "motion-loop-2") return `${base}bg2.mp4`;
  if (theme === "motion-loop-3") return `${base}bg3.mp4`;
  if (theme === "custom-video") return customVid || `${base}bg1.mp4`;
  return null;
}
function isVideoTheme(theme?: string): boolean {
  return ["custom-video", "motion-loop-1", "motion-loop-2", "motion-loop-3"].includes(theme || "");
}


function configureAutoplayVideo(vid: HTMLVideoElement, src: string) {
  vid.defaultMuted = true;
  vid.muted = true;
  vid.volume = 0;
  vid.loop = true;
  vid.playsInline = true;
  vid.autoplay = true;
  vid.controls = false;
  vid.setAttribute("muted", "");
  vid.setAttribute("autoplay", "");
  vid.setAttribute("playsinline", "");
  vid.setAttribute("webkit-playsinline", "");
  vid.setAttribute("loop", "");
  vid.setAttribute("controlslist", "nodownload nofullscreen noremoteplayback");
  vid.disablePictureInPicture = true;

  const tryPlay = () => {
    if (vid.paused) {
      const p = vid.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          const wake = () => {
            vid.play().catch(() => {});
          };
          window.addEventListener("pointerdown", wake, { once: true });
          window.addEventListener("mousemove", wake, { once: true });
          window.addEventListener("keydown", wake, { once: true });
          window.addEventListener("focus", wake, { once: true });
        });
      }
    }
  };

  vid.addEventListener("loadedmetadata", tryPlay);
  vid.addEventListener("canplay", tryPlay);
  vid.addEventListener("canplaythrough", tryPlay);
  vid.addEventListener("pause", () => {
    if (!vid.ended) {
      setTimeout(tryPlay, 80);
    }
  });

  vid.src = src;
  vid.load();
  tryPlay();
}

const VW = 1920;
const VH = 1080;
const FONT = "Inter, system-ui, sans-serif";

interface FitResult {
  size: number;
  lines: string[];
}

export class SlideCompositor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animFrameId: number | null = null;
  private clockIntervalId: number | null = null;
  private lastAnimatedFrame = 0;
  private currentSlide: Slide | null = null;
  private options: RenderOptions;
  private time = 0;
  private logoImg: HTMLImageElement | null = null;
  private bgImg: HTMLImageElement | null = null;
  private bgVideo: HTMLVideoElement | null = null;
  private slideMediaImg: HTMLImageElement | null = null;
  private slideMediaVideo: HTMLVideoElement | null = null;
  private lastSlideMediaUrl: string | undefined = undefined;
  private fitCache = new Map<string, FitResult>();
  private layoutImageCache = new Map<string, HTMLImageElement>();

  constructor(canvas: HTMLCanvasElement, options: RenderOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: true })!;
    this.options = { obsTheme: "glass-pill", backgroundTheme: "nebula", backgroundDimmer: 0.45, ...options };
    if (this.canvas.parentElement) {
      const parentStyle = getComputedStyle(this.canvas.parentElement);
      if (parentStyle.position === "static") {
        this.canvas.parentElement.style.position = "relative";
      }
      this.canvas.style.position = "relative";
      this.canvas.style.zIndex = "1";
    }
    this.loadLogo(this.options.churchLogo);
    this.loadBgImage(this.options.customBackgroundImage);
    const initialVid = resolveVideoSrc(this.options.backgroundTheme, this.options.customBackgroundVideo);
    this.loadBgVideo(initialVid);
    this.startLoop();
  }

  setSlide(slide: Slide | null) {
    this.currentSlide = slide;
    if (slide?.mediaUrl !== this.lastSlideMediaUrl) {
      this.lastSlideMediaUrl = slide?.mediaUrl;
      this.loadSlideMedia(slide?.mediaUrl, slide?.mediaType);
    }
    this.syncVideoVisibility();
    this.draw();
  }

  setOptions(options: Partial<RenderOptions>) {
    const prevLogo = this.options.churchLogo;
    const prevBgImg = this.options.customBackgroundImage;
    const prevBgVid = this.options.customBackgroundVideo;
    const prevTheme = this.options.backgroundTheme;
    this.options = { ...this.options, ...options };
    if (this.options.churchLogo !== prevLogo) this.loadLogo(this.options.churchLogo);
    if (this.options.customBackgroundImage !== prevBgImg) this.loadBgImage(this.options.customBackgroundImage);

    const effectiveVid = resolveVideoSrc(this.options.backgroundTheme, this.options.customBackgroundVideo);
    const prevEffectiveVid = resolveVideoSrc(prevTheme, prevBgVid);
    if (effectiveVid !== prevEffectiveVid) {
      this.loadBgVideo(effectiveVid);
    }
    this.syncVideoVisibility();
    this.draw();
    this.syncAnimationLoop();
    this.syncClockTimer();
  }

  private syncVideoVisibility() {
    const isBlackout = !!this.options.isBlackout;
    const hasSlideVid = !isBlackout && !this.options.alphaChannel && this.currentSlide?.mediaType === "video" && !!this.slideMediaVideo;
    const hasBgVid = !isBlackout && !this.options.alphaChannel && this.options.showBackground && isVideoTheme(this.options.backgroundTheme) && !hasSlideVid && !!this.bgVideo;

    if (this.bgVideo) {
      this.bgVideo.style.opacity = hasBgVid ? "1" : "0";
      if (hasBgVid && this.bgVideo.paused) this.bgVideo.play().catch(() => {});
    }
    if (this.slideMediaVideo) {
      this.slideMediaVideo.style.opacity = hasSlideVid ? "1" : "0";
      if (hasSlideVid && this.slideMediaVideo.paused) this.slideMediaVideo.play().catch(() => {});
    }
  }

  private loadLogo(src?: string | null) {
    if (!src) {
      this.logoImg = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      this.logoImg = img;
      this.draw();
    };
    img.src = src;
  }

  private loadBgImage(src?: string | null) {
    if (!src) {
      this.bgImg = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      this.bgImg = img;
      this.draw();
    };
    img.src = src;
  }

  private loadBgVideo(src?: string | null) {
    if (!src || this.options.alphaChannel) {
      if (this.bgVideo) {
        this.bgVideo.pause();
        this.bgVideo.removeAttribute("src");
        this.bgVideo.remove();
        this.bgVideo = null;
      }
      return;
    }
    if (this.bgVideo && this.bgVideo.getAttribute("data-src") === src) {
      this.syncVideoVisibility();
      return;
    }
    if (this.bgVideo) {
      this.bgVideo.pause();
      this.bgVideo.removeAttribute("src");
      this.bgVideo.remove();
      this.bgVideo = null;
    }
    const vid = document.createElement("video");
    vid.setAttribute("data-src", src);
    vid.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:0;opacity:0;transition:opacity 0.2s ease;";
    (this.canvas.parentElement || document.body).appendChild(vid);
    configureAutoplayVideo(vid, src);
    this.bgVideo = vid;
    this.syncVideoVisibility();
  }

  private loadSlideMedia(src?: string, type?: "image" | "video") {
    this.slideMediaImg = null;
    if (this.slideMediaVideo) {
      this.slideMediaVideo.pause();
      this.slideMediaVideo.removeAttribute("src");
      this.slideMediaVideo.remove();
      this.slideMediaVideo = null;
    }
    if (!src || this.options.alphaChannel) return;
    if (type === "video") {
      const vid = document.createElement("video");
      vid.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000;pointer-events:none;z-index:0;opacity:0;";
      (this.canvas.parentElement || document.body).appendChild(vid);
      configureAutoplayVideo(vid, src);
      this.slideMediaVideo = vid;
      this.syncVideoVisibility();
    } else {
      const img = new Image();
      img.onload = () => {
        this.slideMediaImg = img;
        this.draw();
      };
      img.src = src;
    }
  }

  toggleSlideVideoPlay(): boolean {
    if (!this.slideMediaVideo) return false;
    if (this.slideMediaVideo.paused) {
      this.slideMediaVideo.play().catch(() => {});
      return true;
    } else {
      this.slideMediaVideo.pause();
      return false;
    }
  }

  restartSlideVideo() {
    if (!this.slideMediaVideo) return;
    this.slideMediaVideo.currentTime = 0;
    this.slideMediaVideo.play().catch(() => {});
  }

  private startLoop() {
    this.draw();
    this.syncAnimationLoop();
    this.syncClockTimer();
  }

  private hasAnimatedBackground(): boolean {
    const theme = this.options.backgroundTheme || "nebula";
    return !this.options.lowSpecMode && !!this.options.showBackground && !this.options.alphaChannel &&
      ["nebula", "worship-gold", "royal-blue", "emerald-calm", "crimson-cross"].includes(theme);
  }

  private syncAnimationLoop() {
    if (!this.hasAnimatedBackground()) {
      if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
      this.lastAnimatedFrame = 0;
      return;
    }
    if (this.animFrameId === null) {
      this.lastAnimatedFrame = 0;
      this.animFrameId = requestAnimationFrame(this.renderAnimatedFrame);
    }
  }

  private renderAnimatedFrame = (timestamp: number) => {
    if (!this.hasAnimatedBackground()) {
      this.animFrameId = null;
      return;
    }
    if (timestamp - this.lastAnimatedFrame >= 1000 / 15) {
      const elapsed = this.lastAnimatedFrame ? timestamp - this.lastAnimatedFrame : 1000 / 15;
      this.time += 0.015 * (elapsed / (1000 / 60));
      this.draw();
      this.lastAnimatedFrame = timestamp;
    }
    this.animFrameId = requestAnimationFrame(this.renderAnimatedFrame);
  };

  private syncClockTimer() {
    const hasClock = !!this.options.clockPosition && this.options.clockPosition !== "none";
    if (hasClock && this.clockIntervalId === null) {
      this.clockIntervalId = window.setInterval(() => this.draw(), 1000);
    } else if (!hasClock && this.clockIntervalId !== null) {
      window.clearInterval(this.clockIntervalId);
      this.clockIntervalId = null;
    }
  }

  destroy() {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    if (this.clockIntervalId !== null) window.clearInterval(this.clockIntervalId);
    this.layoutImageCache.clear();
  }

  // ---------- Texto: quebra de linha e auto-fit ----------

  private wrap(text: string, maxW: number): string[] {
    const out: string[] = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (const word of para.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (line && this.ctx.measureText(test).width > maxW) {
          out.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      out.push(line);
    }
    return out;
  }

  /** Maior fonte (entre max e min) em que o texto cabe em maxW x maxH. */
  private fit(text: string, weight: number, maxW: number, maxH: number, maxSize: number, minSize: number): FitResult {
    const activeFont = this.options.fontFamily || FONT;
    const key = `${activeFont}|${weight}|${maxW}|${maxH}|${maxSize}|${minSize}|${text}`;
    const cached = this.fitCache.get(key);
    if (cached) return cached;

    let result: FitResult = { size: minSize, lines: [] };
    for (let size = maxSize; size >= minSize; size -= 2) {
      this.ctx.font = `${weight} ${size}px ${activeFont}`;
      const lines = this.wrap(text, maxW);
      result = { size, lines };
      if (lines.length * size * 1.3 <= maxH) break;
    }
    if (this.fitCache.size > 200) this.fitCache.clear();
    this.fitCache.set(key, result);
    return result;
  }

  // ---------- Desenho ----------

  private draw() {
    const ctx = this.ctx;
    const scale = this.canvas.width / VW;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.options.alphaChannel) {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    } else {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    if (this.options.isBlackout) return;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    if (this.currentSlide?.layout && this.currentSlide.layout.elements && this.currentSlide.layout.elements.length > 0 && !this.options.isClearText) {
      if (this.options.layout === "lowerThird") {
        const displaySlide: Slide = this.options.uppercaseLyrics
          ? { ...this.currentSlide, text: this.currentSlide.text.toUpperCase() }
          : this.currentSlide;
        this.drawLowerThird(displaySlide);
      } else {
        this.drawNativeSlideLayout(this.currentSlide.layout);
      }
    } else {
      if (this.options.showBackground && !this.options.alphaChannel) this.drawBackground();

      // Se o slide atual for uma Mídia (Imagem, Slide PDF, ou Vídeo), desenha em tela cheia
      if (this.currentSlide?.mediaUrl && !this.options.alphaChannel) {
        this.drawSlideMedia();
      }

      if (!this.options.isClearText && this.currentSlide && this.currentSlide.text.trim()) {
        // Slides de apresentação visual (imagens completas) não têm texto de hino projetado por cima
        if (this.currentSlide.category !== "media" || !this.currentSlide.mediaUrl) {
          const displaySlide: Slide = this.options.uppercaseLyrics
            ? { ...this.currentSlide, text: this.currentSlide.text.toUpperCase() }
            : this.currentSlide;

          if (this.options.layout === "lowerThird") this.drawLowerThird(displaySlide);
          else this.drawFullSlide(displaySlide);
        }
      }
    }

    if (this.options.alertText) this.drawAlertBanner(this.options.alertText);

    if (this.options.clockPosition && this.options.clockPosition !== "none") {
      this.drawClock(this.options.clockPosition);
    }
  }

  private drawNativeSlideLayout(layout: SlideLayout) {
    const ctx = this.ctx;

    // 1. Fundo do Slide
    if (layout.bgImage && !this.options.alphaChannel) {
      let bgImg = this.layoutImageCache.get(layout.bgImage);
      if (!bgImg) {
        bgImg = new Image();
        bgImg.onload = () => this.draw();
        bgImg.src = layout.bgImage;
        this.layoutImageCache.set(layout.bgImage, bgImg);
      }
      if (bgImg.complete && bgImg.naturalWidth > 0) {
        this.drawCoverSource(bgImg, bgImg.naturalWidth, bgImg.naturalHeight);
      }
    } else if (layout.bgColor && !this.options.alphaChannel) {
      ctx.fillStyle = layout.bgColor;
      ctx.fillRect(0, 0, VW, VH);
    } else if (this.options.showBackground && !this.options.alphaChannel) {
      this.drawBackground();
    }

    const activeFont = this.options.fontFamily || FONT;
    const fontStyle = this.options.fontStyle || "bold";
    const defaultWeight = fontStyle === "bold" || fontStyle === "boldItalic" ? 700 : 500;
    const fontPrefix = fontStyle === "italic" || fontStyle === "boldItalic" ? "italic " : "";

    // 2. Elementos em ordem Z
    for (const el of layout.elements) {
      const ex = (el.x / 100) * VW;
      const ey = (el.y / 100) * VH;
      const ew = (el.w / 100) * VW;
      const eh = (el.h / 100) * VH;

      // Forma / Container (Background ou Borda)
      if (el.bgColor || el.borderColor) {
        ctx.save();
        if (el.bgColor) {
          ctx.fillStyle = el.bgColor;
          if (el.borderRadius && el.borderRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(ex, ey, ew, eh, el.borderRadius);
            ctx.fill();
          } else {
            ctx.fillRect(ex, ey, ew, eh);
          }
        }
        if (el.borderColor) {
          ctx.strokeStyle = el.borderColor;
          ctx.lineWidth = 2;
          if (el.borderRadius && el.borderRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(ex, ey, ew, eh, el.borderRadius);
            ctx.stroke();
          } else {
            ctx.strokeRect(ex, ey, ew, eh);
          }
        }
        ctx.restore();
      }

      // Imagem
      if (el.type === "image" && el.imageUrl) {
        let img = this.layoutImageCache.get(el.imageUrl);
        if (!img) {
          img = new Image();
          img.onload = () => this.draw();
          img.src = el.imageUrl;
          this.layoutImageCache.set(el.imageUrl, img);
        }
        if (img.complete && img.naturalWidth > 0) {
          const scale = Math.min(ew / img.naturalWidth, eh / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          const dx = ex + (ew - dw) / 2;
          const dy = ey + (eh - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
        }
      }

      // Texto com Auto-fit dentro do bounding box
      if (el.text && el.text.trim()) {
        const textToDraw = this.options.uppercaseLyrics ? el.text.toUpperCase() : el.text;
        ctx.save();
        const align = el.align || "center";
        ctx.textAlign = align;
        ctx.textBaseline = "middle";

        const padX = Math.min(24, ew * 0.05);
        const padY = Math.min(20, eh * 0.05);
        const maxTextW = Math.max(20, ew - padX * 2);
        const maxTextH = Math.max(20, eh - padY * 2);

        // Cor do texto
        const txtColor = el.color || this.options.textColor || "#ffffff";
        ctx.fillStyle = txtColor;

        if (this.options.textShadowStyle === "soft") {
          ctx.shadowColor = "rgba(0,0,0,0.85)";
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 3;
        }

        const basePt = el.fontSize ? Math.round((el.fontSize / 100) * 1.33) : 38;
        const scaleMult =
          this.options.fontSizeScale === "max" ? 1.2 : this.options.fontSizeScale === "normal" ? 0.9 : 1.0;
        const targetMaxSize = Math.round(Math.max(26, Math.min(108, basePt * scaleMult)));
        const targetMinSize = 16;
        const weight = el.bold ? 700 : defaultWeight;
        const isItalic = el.italic ? "italic " : fontPrefix;

        let chosenSize = targetMinSize;
        let finalLines: string[] = [];

        for (let s = targetMaxSize; s >= targetMinSize; s -= 2) {
          ctx.font = `${isItalic}${weight} ${s}px ${activeFont}`;
          const lines = this.wrap(textToDraw, maxTextW);
          finalLines = lines;
          chosenSize = s;
          if (lines.length * s * 1.25 <= maxTextH) break;
        }

        ctx.font = `${isItalic}${weight} ${chosenSize}px ${activeFont}`;
        const lineHeight = chosenSize * 1.25;
        const totalBlockH = finalLines.length * lineHeight;
        const startY = ey + (eh - totalBlockH) / 2 + lineHeight / 2;
        const textAnchorX =
          align === "center" ? ex + ew / 2 : align === "right" ? ex + ew - padX : ex + padX;

        for (let i = 0; i < finalLines.length; i++) {
          ctx.fillText(finalLines[i], textAnchorX, startY + i * lineHeight);
        }

        ctx.restore();
      }
    }
  }

  private drawCoverSource(source: HTMLImageElement | HTMLVideoElement, srcW: number, srcH: number) {
    if (!srcW || !srcH) return;
    const ctx = this.ctx;
    const scale = Math.max(VW / srcW, VH / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    const dx = (VW - dw) / 2;
    const dy = (VH - dh) / 2;
    ctx.drawImage(source, dx, dy, dw, dh);
  }

  private drawContainSource(source: HTMLImageElement | HTMLVideoElement, srcW: number, srcH: number) {
    if (!srcW || !srcH) return;
    const ctx = this.ctx;
    if (!(source instanceof HTMLVideoElement)) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, VW, VH);
    }
    const scale = Math.min(VW / srcW, VH / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    const dx = (VW - dw) / 2;
    const dy = (VH - dh) / 2;
    ctx.drawImage(source, dx, dy, dw, dh);
  }

  private drawSlideMedia() {
    if (this.slideMediaVideo) {
      this.ctx.clearRect(0, 0, VW, VH);
    } else if (this.slideMediaImg) {
      this.drawContainSource(this.slideMediaImg, this.slideMediaImg.naturalWidth, this.slideMediaImg.naturalHeight);
      if (this.currentSlide?.text?.trim()) {
        const dimmer = this.options.backgroundDimmer ?? 0.65;
        this.ctx.fillStyle = `rgba(0, 0, 0, ${dimmer})`;
        this.ctx.fillRect(0, 0, VW, VH);
      }
    }
  }

  private drawBackground() {
    const ctx = this.ctx;
    const theme = this.options.backgroundTheme || "nebula";
    const dimmer = this.options.backgroundDimmer ?? 0.45;

    if (isVideoTheme(theme) && this.bgVideo) {
      ctx.clearRect(0, 0, VW, VH);
      if (dimmer > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${dimmer})`;
        ctx.fillRect(0, 0, VW, VH);
      }
      return;
    }

    if (theme === "custom-image" && this.bgImg) {
      this.drawCoverSource(this.bgImg, this.bgImg.naturalWidth, this.bgImg.naturalHeight);
      if (dimmer > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${dimmer})`;
        ctx.fillRect(0, 0, VW, VH);
      }
      return;
    }

    if (theme === "solid-dark") {
      ctx.fillStyle = "#06080e";
      ctx.fillRect(0, 0, VW, VH);
      return;
    }

    const palettes: Record<string, [string, string, string, string, string]> = {
      "nebula": ["#312e81", "#1e1b4b", "#0f172a", "#020617", "rgba(165, 180, 252, 0.12)"],
      "worship-gold": ["#78350f", "#451a03", "#1c1917", "#0c0a09", "rgba(251, 191, 36, 0.14)"],
      "royal-blue": ["#1e3a8a", "#172554", "#0f172a", "#020617", "rgba(96, 165, 250, 0.13)"],
      "emerald-calm": ["#065f46", "#064e3b", "#022c22", "#020617", "rgba(52, 211, 153, 0.12)"],
      "crimson-cross": ["#7f1d1d", "#450a0a", "#18181b", "#09090b", "rgba(248, 113, 113, 0.12)"]
    };

    const [c0, c1, c2, c3, particleColor] = palettes[theme] || palettes["nebula"];

    if (this.options.lowSpecMode) {
      const grad = ctx.createLinearGradient(0, 0, VW, VH);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c3);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VW, VH);
      return;
    }

    const grad = ctx.createRadialGradient(
      VW * 0.5 + Math.sin(this.time * 0.7) * (VW * 0.25),
      VH * 0.5 + Math.cos(this.time * 0.5) * (VH * 0.2),
      VW * 0.05,
      VW * 0.5,
      VH * 0.5,
      VW * 0.75
    );
    grad.addColorStop(0, c0);
    grad.addColorStop(0.4, c1);
    grad.addColorStop(0.8, c2);
    grad.addColorStop(1, c3);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = particleColor;
    for (let i = 0; i < 14; i++) {
      const x = (Math.sin(this.time * 0.3 + i * 2) + 1) * 0.5 * VW;
      const y = (Math.cos(this.time * 0.2 + i * 3) + 1) * 0.5 * VH;
      const r = 40 + Math.sin(this.time + i) * 20;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFullSlide(slide: Slide) {
    const ctx = this.ctx;
    const activeFont = this.options.fontFamily || FONT;
    const activeColor = this.options.textColor || "#ffffff";
    const scale = this.options.fontSizeScale || "large";
    const style = this.options.fontStyle || "bold";
    const shadow = this.options.textShadowStyle || "soft";
    const showHeader = slide.category === "bible"
      ? (this.options.bibleReferenceFormat !== "inline")
      : (this.options.showSongTitle !== false);

    const isFooter = slide.category === "bible" && this.options.bibleReferenceFormat === "footer";

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    if (shadow === "soft") {
      ctx.shadowColor = "rgba(0,0,0,0.92)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 4;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
    }

    const marginX = VW * 0.07;
    const maxW = VW - marginX * 2;
    const headerH = (showHeader && !isFooter && slide.header) ? 90 : (isFooter ? 70 : 0);
    const maxH = VH - 2 * 110 - headerH;

    const maxSize = scale === "max" ? 116 : scale === "normal" ? 78 : 96;
    const minSize = scale === "max" ? 44 : scale === "normal" ? 30 : 36;
    const weight = (style === "bold" || style === "boldItalic") ? 700 : 500;
    const fontPrefix = (style === "italic" || style === "boldItalic") ? "italic " : "";

    const { size, lines } = this.fit(slide.text, weight, maxW, maxH, maxSize, minSize);
    const lineH = size * 1.3;
    const blockH = lines.length * lineH;
    const top = (VH - blockH) / 2 + (showHeader && !isFooter ? headerH / 2 : 0);

    // Header (Top)
    const headerTitle = (slide.title && !slide.title.startsWith("Slide "))
      ? slide.title
      : (slide.category === "bible" ? (slide.header || "") : "");

    if (showHeader && !isFooter && headerTitle) {
      ctx.font = `600 34px ${activeFont}`;
      ctx.fillStyle = "#a5b4fc";
      ctx.fillText(headerTitle.toUpperCase(), VW / 2, top - 30);
    }

    // Main Lines
    ctx.font = `${fontPrefix}${weight} ${size}px ${activeFont}`;
    ctx.fillStyle = activeColor;
    let y = top + size;
    for (const line of lines) {
      if (shadow === "outline") {
        ctx.lineWidth = Math.max(5, Math.round(size * 0.08));
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(0, 0, 0, 0.96)";
        ctx.strokeText(line, VW / 2, y);
      }
      ctx.fillText(line, VW / 2, y);
      y += lineH;
    }

    // Footer (Bottom) for Bible
    if (isFooter && slide.header) {
      ctx.font = `600 30px ${activeFont}`;
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(slide.header, VW / 2, y + 25);
    }

    ctx.restore();
  }

  private drawLowerThird(slide: Slide) {
    const theme = this.options.obsTheme || "glass-pill";
    if (theme === "clean-minimal") {
      this.ltMinimal(slide);
    } else if (theme === "full-width") {
      this.ltFullWidth(slide);
    } else if (theme === "bible-box") {
      this.ltBibleBox(slide);
    } else if (theme === "glass-pill") {
      this.ltGlassPill(slide);
    } else if (theme === "custom-html") {
      // Custom HTML mode: Canvas is transparent, HTML overlay handles presentation
    } else {
      this.drawConfiguredLowerThird(slide);
    }
  }

  private drawConfiguredLowerThird(slide: Slide) {
    const ctx = this.ctx;
    ctx.save();
    const shape = this.options.obsShape || "pill";
    const pos = this.options.obsPosition || "bottom";
    const align = this.options.obsTextAlign || "center";
    const bg = this.options.obsBgColor || "rgba(10, 14, 24, 0.88)";
    const color = this.options.obsTextColor || "#ffffff";
    const accent = this.options.obsAccentColor || "#818cf8";
    const showHeader = this.options.obsShowHeader !== false && !!slide.header;
    const isBold = this.options.obsBold !== false;
    const fontScale = this.options.obsFontSize || "large";

    const maxFont = fontScale === "huge" ? 54 : fontScale === "normal" ? 36 : 44;
    const minFont = fontScale === "huge" ? 34 : fontScale === "normal" ? 24 : 28;

    const maxW = shape === "full-width" ? VW - 140 : shape === "minimal" ? VW - 180 : 1420;
    const { size, lines } = this.ltLines(slide, isBold ? 700 : 500, maxW, 3, maxFont, minFont);
    const lineH = size * 1.32;
    const headerH = showHeader ? 38 : 0;
    const blockH = headerH + lines.length * lineH;

    const padY = 22;
    const padX = shape === "pill" ? 54 : 36;
    const cardH = blockH + padY * 2;
    const cardW = shape === "full-width" ? VW : Math.min(VW - 120, maxW + padX * 2);

    const cardY = pos === "top" ? 50 : (shape === "full-width" ? VH - cardH : VH - cardH - 50);
    const cardX = shape === "full-width" ? 0 : (VW - cardW) / 2;

    if (shape === "full-width") {
      ctx.fillStyle = bg;
      ctx.fillRect(0, cardY, VW, cardH);
      ctx.fillStyle = accent;
      ctx.fillRect(0, cardY, VW, 5);
    } else if (shape === "pill") {
      ctx.fillStyle = bg;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = 30;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 9999);
      ctx.fill();
      ctx.stroke();
    } else if (shape === "card") {
      ctx.fillStyle = bg;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
      ctx.lineWidth = 1;
      ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
      ctx.shadowBlur = 32;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, 18);
      ctx.fill();
      ctx.stroke();

      // Accent left bar
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 6, cardH, 4);
      ctx.fill();
    }

    // Text rendering
    ctx.textAlign = align;
    const textX = align === "center" ? VW / 2 : (shape === "full-width" ? 70 : cardX + padX);
    let curY = cardY + padY;

    if (showHeader) {
      ctx.font = `700 ${Math.round(size * 0.48)}px ${FONT}`;
      ctx.fillStyle = accent;
      ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
      ctx.shadowBlur = 10;
      ctx.fillText(slide.header.toUpperCase(), textX, curY + Math.round(size * 0.44));
      curY += headerH;
    }

    ctx.font = `${isBold ? "700" : "500"} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    if (shape === "minimal") {
      ctx.lineWidth = 6;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    }
    curY += size * 0.92;
    for (const line of lines) {
      if (shape === "minimal") {
        ctx.strokeText(line, textX, curY);
      }
      ctx.fillText(line, textX, curY);
      curY += lineH;
    }

    ctx.restore();
  }

  private ltLines(slide: Slide, weight: number, maxW: number, maxLines: number, maxSize: number, minSize: number): FitResult {
    // Orcamento de altura = maxLines linhas no tamanho maximo; a fonte reduz
    // ate caber. O limite duro de linhas evita faixas gigantes.
    const r = this.fit(slide.text, weight, maxW, maxLines * maxSize * 1.3, maxSize, minSize);
    const cap = Math.ceil((maxLines * maxSize) / minSize);
    if (r.lines.length > cap) {
      const lines = r.lines.slice(0, cap);
      lines[cap - 1] = lines[cap - 1].replace(/\s*\S*$/, "") + "\u2026";
      return { size: r.size, lines };
    }
    return r;
  }

  private ltMinimal(slide: Slide) {
    const ctx = this.ctx;
    ctx.save();
    const x = 90;
    const logoSpace = this.logoImg ? 140 : 0;
    const textX = x + logoSpace;
    const { size, lines } = this.ltLines(slide, 700, VW - 2 * x - logoSpace, 4, 52, 34);
    const lineH = size * 1.3;
    const headerH = slide.header ? 44 : 0;
    const blockH = headerH + lines.length * lineH;
    let y = VH - 70 - blockH;

    if (this.logoImg) {
      const s = Math.min(blockH + 10, 120);
      ctx.drawImage(this.logoImg, x, y + (blockH - s) / 2, s, s);
    }

    ctx.textAlign = "left";
    if (slide.header) {
      ctx.font = `800 28px ${FONT}`;
      ctx.fillStyle = "#818cf8";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 8;
      ctx.fillText(slide.header.toUpperCase(), textX, y + 28);
      y += headerH;
    }
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.fillStyle = "#fff";
    y += size;
    for (const line of lines) {
      ctx.strokeText(line, textX, y);
      ctx.fillText(line, textX, y);
      y += lineH;
    }
    ctx.restore();
  }

  private ltFullWidth(slide: Slide) {
    const ctx = this.ctx;
    ctx.save();
    const logoSpace = this.logoImg ? 170 : 0;
    const textX = 90 + logoSpace;
    const { size, lines } = this.ltLines(slide, 600, VW - textX - 90, 4, 46, 30);
    const lineH = size * 1.3;
    const headerH = slide.header ? 40 : 0;
    const barH = 50 + headerH + lines.length * lineH;
    const barY = VH - barH;

    ctx.fillStyle = "rgba(10,11,16,0.94)";
    ctx.fillRect(0, barY, VW, barH);
    ctx.fillStyle = "#6366f1";
    ctx.fillRect(0, barY, VW, 6);

    if (this.logoImg) {
      const s = Math.min(barH - 40, 130);
      ctx.drawImage(this.logoImg, 60, barY + (barH - s) / 2, s, s);
    }

    ctx.textAlign = "left";
    let y = barY + 30;
    if (slide.header) {
      ctx.font = `700 26px ${FONT}`;
      ctx.fillStyle = "#a5b4fc";
      ctx.fillText(slide.header.toUpperCase(), textX, y + 20);
      y += headerH;
    }
    ctx.font = `600 ${size}px ${FONT}`;
    ctx.fillStyle = "#fff";
    y += size;
    for (const line of lines) {
      ctx.fillText(line, textX, y);
      y += lineH;
    }
    ctx.restore();
  }

  private ltGlassPill(slide: Slide) {
    const ctx = this.ctx;
    ctx.save();
    const bx = 90;
    const bw = VW - 180;
    const pad = 44;
    const logoSpace = this.logoImg ? 150 : 0;
    const textX = bx + pad + logoSpace;
    const { size, lines } = this.ltLines(slide, 600, bw - pad * 2 - logoSpace, 4, 46, 30);
    const lineH = size * 1.3;
    const headerH = slide.header ? 40 : 0;
    const bh = pad + headerH + lines.length * lineH + 12;
    const by = VH - bh - 60;

    ctx.fillStyle = "rgba(10,11,16,0.88)";
    ctx.strokeStyle = "rgba(99,102,241,0.5)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#6366f1";
    ctx.beginPath();
    ctx.roundRect(bx + 8, by + 22, 9, bh - 44, 4);
    ctx.fill();

    if (this.logoImg) {
      const s = Math.min(bh - 50, 120);
      ctx.drawImage(this.logoImg, bx + pad, by + (bh - s) / 2, s, s);
    }

    ctx.textAlign = "left";
    let y = by + pad / 2 + 6;
    if (slide.header) {
      ctx.font = `700 26px ${FONT}`;
      ctx.fillStyle = "#818cf8";
      ctx.fillText(slide.header.toUpperCase(), textX, y + 22);
      y += headerH;
    }
    ctx.font = `600 ${size}px ${FONT}`;
    ctx.fillStyle = "#fff";
    y += size;
    for (const line of lines) {
      ctx.fillText(line, textX, y);
      y += lineH;
    }
    ctx.restore();
  }

  private ltBibleBox(slide: Slide) {
    const ctx = this.ctx;
    ctx.save();
    const bx = 120;
    const bw = VW - 240;
    const pad = 40;
    const logoSpace = this.logoImg ? 140 : 0;
    const textX = bx + pad + logoSpace;
    const { size, lines } = this.ltLines(slide, 600, bw - pad * 2 - logoSpace, 4, 44, 28);
    const lineH = size * 1.32;
    const bh = pad + lines.length * lineH + 24;
    const by = VH - bh - 56;

    // Main dark emerald/gold sermon box
    ctx.fillStyle = "rgba(8, 15, 22, 0.94)";
    ctx.strokeStyle = "rgba(16, 185, 129, 0.65)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 18);
    ctx.fill();
    ctx.stroke();

    // Top floating scripture reference badge
    if (slide.header) {
      ctx.font = `800 24px ${FONT}`;
      const refText = `📖 ${slide.header.toUpperCase()}`;
      const refW = ctx.measureText(refText).width + 36;
      const refH = 42;
      const refX = bx + 32;
      const refY = by - refH / 2;

      ctx.fillStyle = "#059669";
      ctx.beginPath();
      ctx.roundRect(refX, refY, refW, refH, 10);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.fillText(refText, refX + 18, refY + 29);
    }

    if (this.logoImg) {
      const s = Math.min(bh - 36, 110);
      ctx.drawImage(this.logoImg, bx + pad, by + (bh - s) / 2 + 6, s, s);
    }

    ctx.textAlign = "left";
    ctx.font = `600 ${size}px ${FONT}`;
    ctx.fillStyle = "#f8fafc";
    let y = by + pad / 2 + size + 10;
    for (const line of lines) {
      ctx.fillText(line, textX, y);
      y += lineH;
    }
    ctx.restore();
  }

  private drawAlertBanner(alert: string) {
    const ctx = this.ctx;
    const h = 72;
    ctx.save();
    ctx.fillStyle = "rgba(220,38,38,0.95)";
    ctx.fillRect(0, VH - h, VW, h);
    ctx.font = `700 34px ${FONT}`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(`AVISO: ${alert}`, VW / 2, VH - 24);
    ctx.restore();
  }

  private drawClock(pos: "topRight" | "bottomRight" | "bottomLeft") {
    const ctx = this.ctx;
    ctx.save();
    const now = new Date();
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    ctx.font = "700 36px monospace";
    const textW = ctx.measureText(timeStr).width;
    const pw = textW + 56;
    const ph = 58;

    let px = VW - pw - 60;
    let py = 50;

    if (pos === "bottomRight") {
      px = VW - pw - 60;
      py = VH - ph - 60;
    } else if (pos === "bottomLeft") {
      px = 60;
      py = VH - ph - 60;
    } else if (pos === "topRight") {
      px = VW - pw - 60;
      py = 50;
    }

    // Glass pill background
    ctx.fillStyle = "rgba(10, 12, 18, 0.78)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 29);
    ctx.fill();
    ctx.stroke();

    // Subtle emerald indicator dot (live clock)
    ctx.fillStyle = "#10b981";
    ctx.shadowColor = "rgba(16, 185, 129, 0.6)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(px + 24, py + ph / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    // Digital time text
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 6;
    ctx.fillText(timeStr, px + 38, py + ph / 2 + 1);

    ctx.restore();
  }
}
