import type { Slide, PlaylistItem } from "./state";
import { inTauri, tauriInvoke } from "./server";
import { showLoadingHUD, updateLoadingHUD, hideLoadingHUD } from "./loadingHud";
import { parsePptxNative } from "../modules/pptxNativeParser";
import { auditPptxPresentation } from "../modules/slideAuditor";

// Bibliotecas pesadas carregadas sob demanda (lazy) — nunca quebram a inicialização do app.
let pdfjsPromise: Promise<any> | null = null;

function hasPdfHeader(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
}

async function loadPdfJs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib: any = await import("pdfjs-dist");
      const pdfjs = lib.getDocument ? lib : lib.default;
      try {
        // @ts-ignore - Vite resolve como URL estática do worker
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.js?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      } catch (e) {
        console.warn("Worker do PDF indisponível, usando modo sem worker:", e);
      }
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

async function loadJSZip(): Promise<any> {
  const mod: any = await import("jszip");
  return mod.default || mod;
}

/**
 * Converte arquivo de apresentação (.pptx, .ppt, .odp) em PDF de alta fidelidade
 * usando o LibreOffice no backend nativo Tauri ou servidor local Vite.
 */
export async function convertPresentationToPdf(
  file: File,
  onProgress?: (percent: number, countText?: string, subtitle?: string) => void
): Promise<File | null> {
  onProgress?.(15, "Iniciando renderizador...", "Preparando conversão via LibreOffice...");

  // 1. Tenta via comando nativo Tauri (se estiver rodando no app desktop)
  if (inTauri()) {
    try {
      onProgress?.(25, "Executando LibreOffice...", "Processando layout original, imagens e fontes...");
      const arrayBuffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(arrayBuffer));
      const resBytes = await tauriInvoke<number[]>("convert_presentation_to_pdf", {
        filename: file.name,
        data: bytes
      });
      if (resBytes && resBytes.length > 0) {
        const u8 = new Uint8Array(resBytes);
        if (!hasPdfHeader(u8)) throw new Error("O conversor nativo não retornou um arquivo PDF válido.");
        return new File([u8], file.name.replace(/\.[^/.]+$/, ".pdf"), { type: "application/pdf" });
      }
    } catch (err) {
      console.warn("Falha na conversão Tauri via LibreOffice:", err);
      return null;
    }
    return null;
  }

  // 2. Tenta via endpoint do servidor local Vite (desenvolvimento / fallback)
  try {
    onProgress?.(30, "Processando apresentação...", "Convertendo slides no motor local...");
    const arrayBuffer = await file.arrayBuffer();
    const ext = file.name.split(".").pop() || "pptx";
    const res = await fetch(`/__convert_presentation?ext=${encodeURIComponent(ext)}&name=${encodeURIComponent(file.name)}`, {
      method: "POST",
      body: arrayBuffer
    });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (!hasPdfHeader(bytes)) throw new Error("O conversor local não retornou um arquivo PDF válido.");
        return new File([bytes], file.name.replace(/\.[^/.]+$/, ".pdf"), { type: "application/pdf" });
      }
    }
  } catch (err) {
    console.warn("Falha na conversão via endpoint local:", err);
  }

  return null;
}

/**
 * Converts a PDF file into individual presentation slides, one slide per page.
 */
export async function convertPdfToSlides(
  file: File,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<Slide[]> {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const slides: Slide[] = [];
  const baseTitle = file.name.replace(/\.[^/.]+$/, "");

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    onProgress?.(pageNum, numPages, `Renderizando slide ${pageNum} de ${numPages}...`);
    const page = await pdfDoc.getPage(pageNum);
    // Render at scale 2.0 for razor-sharp projection on 1080p and 4K displays
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");

    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/png");
      slides.push({
        id: `pdf-${Date.now()}-${pageNum}`,
        title: `${baseTitle} - Slide ${pageNum}/${numPages}`,
        header: `${baseTitle}`,
        text: "",
        category: "media",
        mediaUrl: dataUrl,
        mediaType: "image",
        background: { type: "image", value: dataUrl }
      });
    }
  }

  return slides;
}

/**
 * Fallback: extrai textos básicos caso o LibreOffice não esteja instalado na máquina.
 */
export async function convertPptxToSlidesFallback(file: File): Promise<Slide[]> {
  const arrayBuffer = await file.arrayBuffer();
  const JSZip = await loadJSZip();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slides: Slide[] = [];
  const baseTitle = file.name.replace(/\.[^/.]+$/, "");

  const slideEntries: { index: number; path: string }[] = [];
  zip.forEach((relativePath: string) => {
    const match = relativePath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      slideEntries.push({ index: parseInt(match[1], 10), path: relativePath });
    }
  });

  slideEntries.sort((a, b) => a.index - b.index);
  const parser = new DOMParser();

  for (let i = 0; i < slideEntries.length; i++) {
    const entry = slideEntries[i];
    const xmlText = await zip.file(entry.path)?.async("text");
    if (!xmlText) continue;

    const doc = parser.parseFromString(xmlText, "application/xml");
    const textNodes = doc.getElementsByTagName("a:t");
    const lines: string[] = [];
    for (let t = 0; t < textNodes.length; t++) {
      const txt = textNodes[t].textContent?.trim();
      if (txt) lines.push(txt);
    }

    const slideTitle = lines.length > 0 ? lines[0] : `${baseTitle} - Slide ${i + 1}`;
    const body = lines.length > 1 ? lines.slice(1).join("\n") : (lines[0] || "");

    slides.push({
      id: `pptx-${Date.now()}-${i + 1}`,
      title: slideTitle,
      header: baseTitle,
      text: body,
      category: "media",
      background: { type: "color", value: "#0b0f19" }
    });
  }

  return slides;
}

/**
 * Universal media & presentation importer supporting Images, Videos, PDF and PPTX.
 */
export async function processImportFiles(
  files: FileList | File[],
  uploadVideoFn: (file: File) => Promise<string>
): Promise<PlaylistItem[]> {
  const items: PlaylistItem[] = [];
  const fileArray = Array.from(files);
  if (fileArray.length === 0) return items;

  showLoadingHUD("Carregando Arquivos...", "Preparando importação para o culto...");

  try {
    for (let fIdx = 0; fIdx < fileArray.length; fIdx++) {
      const f = fileArray[fIdx];
      const lowerName = f.name.toLowerCase();
      const isVideo = f.type.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/i.test(lowerName);
      const isPdf = f.type === "application/pdf" || lowerName.endsWith(".pdf");
      const isPptx = /\.(pptx?|pptm|odp|fodp|pps|ppsx|ppsm|pot|potx|potm|key)$/i.test(lowerName);

      if (isPptx) {
        showLoadingHUD("Abrindo Apresentação...", `Renderizando "${f.name}" para o telão...`);
        updateLoadingHUD(15, "Iniciando renderizador...", "Convertendo slides mantendo layout e arte originais...");

        let slides: Slide[] = [];

        // 1. Prioridade: Conversão via motor LibreOffice -> PDF com alta fidelidade visual
        try {
          const pdfFile = await convertPresentationToPdf(f, (pct, count, sub) => {
            updateLoadingHUD(pct, count, sub);
          });

          if (pdfFile) {
            slides = await convertPdfToSlides(pdfFile, (curr, tot, msg) => {
              const pct = 50 + Math.round((curr / tot) * 45);
              updateLoadingHUD(pct, `${curr} / ${tot}`, msg);
            });
          }
        } catch (pdfErr) {
          console.warn("Falha na renderização de apresentação via PDF:", pdfErr);
        }

        // 2. Fallback: Se o LibreOffice não estiver disponível ou falhar, extração nativa PPTX
        if (!slides || slides.length === 0) {
          updateLoadingHUD(40, "Extraindo conteúdo...", "Lendo formato PPTX nativo...");
          try {
            slides = await parsePptxNative(f, (curr, tot, msg) => {
              const pct = 40 + Math.round((curr / tot) * 50);
              updateLoadingHUD(pct, `${curr} / ${tot}`, msg);
            });
          } catch (nativeErr) {
            console.warn("Falha no extrator nativo PPTX:", nativeErr);
          }
        }

        // 3. Fallback de emergência (extrai textos simples)
        if (!slides || slides.length === 0) {
          try {
            slides = await convertPptxToSlidesFallback(f);
          } catch (fallbackErr) {
            console.warn("Falha no extrator de fallback:", fallbackErr);
          }
        }

        if (!slides || slides.length === 0) {
          throw new Error(`Não foi possível processar "${f.name}". Certifique-se de que o arquivo não está corrompido ou instale o LibreOffice.`);
        }

        // 4. Executa Auditoria Inteligente de Layout, Fontes e Risco de Transbordo
        let auditReport: any = null;
        try {
          auditReport = await auditPptxPresentation(f);
          if (auditReport && slides.length > 0) {
            auditReport.items.forEach((it: any, sIdx: number) => {
              if (slides[sIdx]) {
                slides[sIdx].auditStatus = it.status;
                slides[sIdx].auditIssue = it.issue;
              }
            });
          }
        } catch (auditErr) {
          console.warn("Falha na auditoria de layout da apresentação:", auditErr);
        }

        if (slides.length > 0) {
          let originalPath = (f as any).path as string | undefined;
          if (!originalPath && inTauri()) {
            try {
              const arrayBuffer = await f.arrayBuffer();
              originalPath = await tauriInvoke<string>("cache_presentation_file", {
                filename: f.name,
                data: Array.from(new Uint8Array(arrayBuffer))
              });
            } catch (e) {
              console.warn("Falha ao salvar cache do arquivo de apresentação:", e);
            }
          }

          const isFullGraphic = slides.some((s) => s.mediaType === "image");
          const toastMsg = isFullGraphic
            ? `${slides.length} slides visuais em alta resolução prontos para o telão!`
            : `${slides.length} slides carregados em modo texto. Dica: Para projetar com as imagens, formas e cores idênticas ao PowerPoint sem o LibreOffice, salve seus slides diretamente como PDF (.pdf) e importe no Altaris com qualidade 100% fiel!`;

          window.dispatchEvent(new CustomEvent("altaris:toast", {
            detail: {
              title: isFullGraphic ? "✅ Apresentação Pronta para Projeção!" : "ℹ️ Apresentação em Modo Texto",
              message: toastMsg,
              duration: 8000
            }
          }));

          items.push({
            id: `media-pres-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: `📊 ${f.name.replace(/\.[^/.]+$/, "")} (${slides.length} slides)`,
            type: "media",
            author: "Apresentação EBD / Slides",
            slides,
            presentationPath: originalPath,
            auditReport,
            originalFile: f
          });
        }
      } else if (isPdf) {
        showLoadingHUD("Abrindo PDF...", `Renderizando páginas de "${f.name}"...`);
        updateLoadingHUD(15, "Iniciando PDF...", "Lendo documento vetorial...");

        const slides = await convertPdfToSlides(f, (curr, tot, msg) => {
          const pct = 15 + Math.round((curr / tot) * 82);
          updateLoadingHUD(pct, `${curr} / ${tot}`, msg);
        });

        if (slides.length > 0) {
          items.push({
            id: `media-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: `📄 ${f.name.replace(/\.[^/.]+$/, "")} (${slides.length} slides)`,
            type: "media",
            author: "Apresentação PDF",
            slides
          });
        }
      } else if (isVideo) {
        showLoadingHUD("Processando Vídeo...", `Enviando "${f.name}"...`);
        updateLoadingHUD(40, "Carregando vídeo...", "Preparando reprodução no telão...");
        const url = await uploadVideoFn(f);
        items.push({
          id: `media-vid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: `🎬 ${f.name.replace(/\.[^/.]+$/, "")}`,
          type: "media",
          author: "Vídeo",
          slides: [
            {
              id: `vid-slide-${Date.now()}`,
              title: f.name.replace(/\.[^/.]+$/, ""),
              header: `Vídeo: ${f.name}`,
              text: "",
              category: "media",
              mediaUrl: url,
              mediaType: "video",
              background: { type: "color", value: "#000000" }
            }
          ]
        });
      } else {
        // Imagem comum
        showLoadingHUD("Carregando Imagem...", `Processando "${f.name}"...`);
        updateLoadingHUD(60, "Processando imagem...", "Preparando exibição...");
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || "");
          reader.readAsDataURL(f);
        });

        if (dataUrl) {
          items.push({
            id: `media-img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            title: `🖼️ ${f.name.replace(/\.[^/.]+$/, "")}`,
            type: "media",
            author: "Imagem",
            slides: [
              {
                id: `img-slide-${Date.now()}`,
                title: f.name.replace(/\.[^/.]+$/, ""),
                header: "",
                text: "",
                category: "media",
                mediaUrl: dataUrl,
                mediaType: "image",
                background: { type: "image", value: dataUrl }
              }
            ]
          });
        }
      }
    }
  } finally {
    updateLoadingHUD(100, "Concluído!", "Slides prontos para o culto.");
    setTimeout(() => {
      hideLoadingHUD();
    }, 350);
  }

  return items;
}
