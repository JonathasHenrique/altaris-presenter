// OpenPresenter Compositor
// Desenha sempre em um espaço virtual 1920x1080 e escala para o canvas real,
// com quebra de linha e ajuste automático de fonte (auto-fit).
import { Slide } from "./state";

export interface RenderOptions {
  layout: "full" | "lowerThird";
  showBackground: boolean;
  alphaChannel: boolean;
  isBlackout?: boolean;
  isClearText?: boolean;
  alertText?: string;
  obsTheme?: "glass-pill" | "clean-minimal" | "full-width" | "bible-box";
  churchLogo?: string | null;
  lowSpecMode?: boolean;
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
  private currentSlide: Slide | null = null;
  private options: RenderOptions;
  private time = 0;
  private logoImg: HTMLImageElement | null = null;
  private fitCache = new Map<string, FitResult>();

  constructor(canvas: HTMLCanvasElement, options: RenderOptions) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: options.alphaChannel })!;
    this.options = { obsTheme: "glass-pill", ...options };
    this.loadLogo(this.options.churchLogo);
    this.startLoop();
  }

  setSlide(slide: Slide | null) {
    this.currentSlide = slide;
    if (this.options.lowSpecMode) this.draw();
  }

  setOptions(options: Partial<RenderOptions>) {
    const prevLogo = this.options.churchLogo;
    this.options = { ...this.options, ...options };
    if (this.options.churchLogo !== prevLogo) this.loadLogo(this.options.churchLogo);
    if (this.options.lowSpecMode) this.draw();
  }

  private loadLogo(src?: string | null) {
    if (!src) {
      this.logoImg = null;
      return;
    }
    const img = new Image();
    img.onload = () => {
      this.logoImg = img;
    };
    img.src = src;
  }

  private startLoop() {
    const render = () => {
      // Modo PC Antigo: só redesenha quando algo muda (0% CPU em repouso).
      if (!this.options.lowSpecMode) {
        this.time += 0.015;
        this.draw();
      }
      this.animFrameId = requestAnimationFrame(render);
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  destroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
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
    const key = `${weight}|${maxW}|${maxH}|${maxSize}|${minSize}|${text}`;
    const cached = this.fitCache.get(key);
    if (cached) return cached;

    let result: FitResult = { size: minSize, lines: [] };
    for (let size = maxSize; size >= minSize; size -= 2) {
      this.ctx.font = `${weight} ${size}px ${FONT}`;
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

    if (this.options.showBackground && !this.options.alphaChannel) this.drawBackground();

    if (!this.options.isClearText && this.currentSlide) {
      if (this.options.layout === "lowerThird") this.drawLowerThird(this.currentSlide);
      else this.drawFullSlide(this.currentSlide);
    }

    if (this.options.alertText) this.drawAlertBanner(this.options.alertText);
  }

  private drawBackground() {
    const ctx = this.ctx;

    if (this.options.lowSpecMode) {
      const grad = ctx.createLinearGradient(0, 0, VW, VH);
      grad.addColorStop(0, "#1e1b4b");
      grad.addColorStop(1, "#090d16");
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
    grad.addColorStop(0, "#312e81");
    grad.addColorStop(0.4, "#1e1b4b");
    grad.addColorStop(0.8, "#0f172a");
    grad.addColorStop(1, "#020617");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);

    ctx.fillStyle = "rgba(165, 180, 252, 0.12)";
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
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 16;

    const marginX = VW * 0.07;
    const maxW = VW - marginX * 2;
    const headerH = slide.header ? 90 : 0;
    const maxH = VH - 2 * 110 - headerH;

    const { size, lines } = this.fit(slide.text, 700, maxW, maxH, 96, 36);
    const lineH = size * 1.3;
    const blockH = lines.length * lineH;
    const top = (VH - blockH) / 2 + headerH / 2;

    if (slide.header) {
      ctx.font = `600 34px ${FONT}`;
      ctx.fillStyle = "#a5b4fc";
      ctx.fillText(slide.header.toUpperCase(), VW / 2, top - 30);
    }

    ctx.font = `700 ${size}px ${FONT}`;
    ctx.fillStyle = "#fff";
    let y = top + size;
    for (const line of lines) {
      ctx.fillText(line, VW / 2, y);
      y += lineH;
    }
    ctx.restore();
  }

  private drawLowerThird(slide: Slide) {
    const theme = this.options.obsTheme || "glass-pill";
    if (theme === "clean-minimal") this.ltMinimal(slide);
    else if (theme === "full-width") this.ltFullWidth(slide);
    else this.ltGlassPill(slide);
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
    const { size, lines } = this.ltLines(slide, 700, VW - 2 * x, 4, 52, 34);
    const lineH = size * 1.3;
    const headerH = slide.header ? 44 : 0;
    const blockH = headerH + lines.length * lineH;
    let y = VH - 70 - blockH;

    ctx.textAlign = "left";
    if (slide.header) {
      ctx.font = `800 28px ${FONT}`;
      ctx.fillStyle = "#818cf8";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 8;
      ctx.fillText(slide.header.toUpperCase(), x, y + 28);
      y += headerH;
    }
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.fillStyle = "#fff";
    y += size;
    for (const line of lines) {
      ctx.strokeText(line, x, y);
      ctx.fillText(line, x, y);
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
}
