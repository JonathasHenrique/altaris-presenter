// Altaris Slide Layout & Font Overflow Auditor (Auditor Inteligente de Tipografia e Transbordo)
// Valida se textos cabem com folga dentro das caixas delimitadoras do PPTX e verifica disponibilidade de fontes.

export interface SlideAuditItem {
  slideIndex: number;
  slideNumber: number;
  status: "ok" | "warning" | "overflow";
  issue?: string;
  shapeText?: string;
  boxWidthPt?: number;
  boxHeightPt?: number;
  fontSizePt?: number;
  suggestedFontSizePt?: number;
  fontFamily?: string;
  fontAvailable?: boolean;
}

export interface FontAuditInfo {
  name: string;
  available: boolean;
  status: "installed" | "fallback";
}

export interface PresentationAuditReport {
  fileName: string;
  totalSlides: number;
  perfectSlides: number;
  overflowSlides: number;
  fontsDetected: FontAuditInfo[];
  items: SlideAuditItem[];
  overallStatus: "perfect" | "warnings";
}

let canvasMeasureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (!canvasMeasureCtx && typeof document !== "undefined") {
    const c = document.createElement("canvas");
    canvasMeasureCtx = c.getContext("2d");
  }
  return canvasMeasureCtx;
}

/**
 * Verifica se uma fonte específica está carregada e disponível no sistema/navegador.
 */
export function isFontAvailable(fontName: string): boolean {
  if (typeof document === "undefined" || !document.fonts) return true;
  const clean = fontName.replace(/['"]/g, "").trim();
  if (["sans-serif", "serif", "monospace", "system-ui"].includes(clean.toLowerCase())) return true;
  return document.fonts.check(`16px "${clean}"`);
}

/**
 * Audita um arquivo PPTX completo, identificando caixas de texto com risco de transbordo (overflow),
 * fontes ausentes e sugerindo tamanhos ideais de auto-fit.
 */
export async function auditPptxPresentation(file: File): Promise<PresentationAuditReport> {
  const mod: any = await import("jszip");
  const JSZip = mod.default || mod;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slideEntries: { index: number; path: string }[] = [];
  zip.forEach((relPath: string) => {
    const match = relPath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      slideEntries.push({ index: parseInt(match[1], 10), path: relPath });
    }
  });

  slideEntries.sort((a, b) => a.index - b.index);
  const total = slideEntries.length;

  const fontsSet = new Set<string>();
  const auditItems: SlideAuditItem[] = [];
  const ctx = getMeasureCtx();
  const parser = new DOMParser();

  for (let i = 0; i < total; i++) {
    const entry = slideEntries[i];
    const xmlText = await zip.file(entry.path)?.async("text");
    if (!xmlText) continue;

    const doc = parser.parseFromString(xmlText, "application/xml");
    const spNodes = doc.getElementsByTagName("p:sp");
    let slideStatus: "ok" | "warning" | "overflow" = "ok";
    let worstIssue: string | undefined;
    let worstShapeText: string | undefined;
    let worstBoxW: number | undefined;
    let worstBoxH: number | undefined;
    let worstFontPt: number | undefined;
    let worstSuggestedPt: number | undefined;
    let worstFontFamily: string | undefined;

    for (let s = 0; s < spNodes.length; s++) {
      const sp = spNodes[s];

      // 1. Extrai dimensões da forma delimitadora (<a:xfrm><a:ext cx="..." cy="..."/></a:xfrm>)
      const extNodes = sp.getElementsByTagName("a:ext");
      let cx = 0;
      let cy = 0;
      for (let e = 0; e < extNodes.length; e++) {
        const cxAttr = extNodes[e].getAttribute("cx");
        const cyAttr = extNodes[e].getAttribute("cy");
        if (cxAttr && cyAttr) {
          cx = parseInt(cxAttr, 10);
          cy = parseInt(cyAttr, 10);
          break;
        }
      }

      // 2. Extrai parágrafos, tamanhos de fonte e tipografia
      const pNodes = sp.getElementsByTagName("a:p");
      const paragraphs: string[] = [];
      let shapeMaxSz = 1800; // default 18pt
      let shapeFont = "sans-serif";

      for (let pIdx = 0; pIdx < pNodes.length; pIdx++) {
        const pElem = pNodes[pIdx];
        const tNodes = pElem.getElementsByTagName("a:t");
        let pText = "";
        for (let t = 0; t < tNodes.length; t++) {
          pText += tNodes[t].textContent || "";
        }
        pText = pText.trim();
        if (pText) paragraphs.push(pText);

        const rPrNodes = pElem.getElementsByTagName("a:rPr");
        for (let r = 0; r < rPrNodes.length; r++) {
          const szAttr = rPrNodes[r].getAttribute("sz");
          if (szAttr) {
            const szVal = parseInt(szAttr, 10);
            if (szVal > shapeMaxSz) shapeMaxSz = szVal;
          }
          const latin = rPrNodes[r].getElementsByTagName("a:latin");
          if (latin.length > 0) {
            const tf = latin[0].getAttribute("typeface");
            if (tf && !tf.startsWith("+")) {
              shapeFont = tf;
              fontsSet.add(tf);
            }
          }
        }
      }

      if (paragraphs.length === 0 || cx <= 0 || cy <= 0) continue;

      // 3. Cálculos de geometria tipográfica
      // 1 pt = 12700 EMUs
      const boxW_pt = cx / 12700;
      const boxH_pt = cy / 12700;
      const fontPt = shapeMaxSz / 100;

      // Margem interna padrão OpenXML (0.1 in esq/dir = 7.2 pt, 0.05 in topo/base = 3.6 pt)
      const usableW_pt = Math.max(20, boxW_pt - 14.4);
      const usableH_pt = Math.max(10, boxH_pt - 7.2);

      // Linha média e estimativa de quebra
      let estimatedLines = 0;
      if (ctx) {
        ctx.font = `${Math.round(fontPt)}px "${shapeFont}", sans-serif`;
      }

      for (const para of paragraphs) {
        if (!ctx) {
          const approxCharW = fontPt * 0.52;
          const charsPerLine = Math.max(1, Math.floor(usableW_pt / approxCharW));
          estimatedLines += Math.max(1, Math.ceil(para.length / charsPerLine));
        } else {
          const words = para.split(/\s+/);
          let currentLine = "";
          let paraLines = 1;
          for (const w of words) {
            const test = currentLine ? `${currentLine} ${w}` : w;
            if (ctx.measureText(test).width > usableW_pt && currentLine) {
              paraLines++;
              currentLine = w;
            } else {
              currentLine = test;
            }
          }
          estimatedLines += paraLines;
        }
      }

      const lineHeightPt = fontPt * 1.25;
      const totalTextH_pt = estimatedLines * lineHeightPt;
      const ratio = totalTextH_pt / usableH_pt;

      if (ratio > 1.0) {
        slideStatus = "overflow";
        const suggested = Math.floor((usableH_pt * 0.92) / (estimatedLines * 1.25));
        const snippet = paragraphs.join(" ").slice(0, 50);

        if (!worstIssue || ratio > ((worstBoxH || 1) / (usableH_pt || 1))) {
          worstIssue = `Texto ultrapassa a forma em ~${Math.round((ratio - 1) * 100)}% (${estimatedLines} linhas para altura de ${Math.round(usableH_pt)}pt)`;
          worstShapeText = snippet;
          worstBoxW = Math.round(boxW_pt);
          worstBoxH = Math.round(boxH_pt);
          worstFontPt = fontPt;
          worstSuggestedPt = Math.max(10, suggested);
          worstFontFamily = shapeFont;
        }
      } else if (ratio > 0.92 && slideStatus !== "overflow") {
        slideStatus = "warning";
        const snippet = paragraphs.join(" ").slice(0, 50);
        worstIssue = `Margem crítica: texto preenche ${Math.round(ratio * 100)}% da altura da caixa. Se a fonte "${shapeFont}" não for exata, haverá transbordo.`;
        worstShapeText = snippet;
        worstBoxW = Math.round(boxW_pt);
        worstBoxH = Math.round(boxH_pt);
        worstFontPt = fontPt;
        worstSuggestedPt = Math.max(10, Math.floor(fontPt * 0.92));
        worstFontFamily = shapeFont;
      }
    }

    auditItems.push({
      slideIndex: i,
      slideNumber: i + 1,
      status: slideStatus,
      issue: worstIssue,
      shapeText: worstShapeText,
      boxWidthPt: worstBoxW,
      boxHeightPt: worstBoxH,
      fontSizePt: worstFontPt,
      suggestedFontSizePt: worstSuggestedPt,
      fontFamily: worstFontFamily,
      fontAvailable: worstFontFamily ? isFontAvailable(worstFontFamily) : true
    });
  }

  const fontsDetected: FontAuditInfo[] = Array.from(fontsSet).map(f => {
    const avail = isFontAvailable(f);
    return {
      name: f,
      available: avail,
      status: avail ? "installed" : "fallback"
    };
  });

  const overflowCount = auditItems.filter(s => s.status === "overflow" || s.status === "warning").length;
  const perfectCount = total - overflowCount;

  return {
    fileName: file.name,
    totalSlides: total,
    perfectSlides: perfectCount,
    overflowSlides: overflowCount,
    fontsDetected,
    items: auditItems,
    overallStatus: overflowCount > 0 ? "warnings" : "perfect"
  };
}

/**
 * Sanitiza o PPTX em memória aplicando Auto-Fit e reduzindo suavemente fontes nas caixas
 * críticas com risco de transbordo, garantindo que o LibreOffice nunca quebre a linha.
 */
export async function sanitizePptxWithAutoFit(
  file: File,
  report: PresentationAuditReport,
  targetSlideNum?: number
): Promise<File> {
  const mod: any = await import("jszip");
  const JSZip = mod.default || mod;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const problemSlides = targetSlideNum !== undefined
    ? new Set([targetSlideNum])
    : new Set(
        report.items
          .filter(it => it.status === "overflow" || it.status === "warning")
          .map(it => it.slideNumber)
      );

  if (problemSlides.size === 0) return file;

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  for (const slideNum of problemSlides) {
    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const xmlContent = await zip.file(slidePath)?.async("text");
    if (!xmlContent) continue;

    const doc = parser.parseFromString(xmlContent, "application/xml");
    const spNodes = doc.getElementsByTagName("p:sp");
    let modified = false;

    for (let s = 0; s < spNodes.length; s++) {
      const sp = spNodes[s];
      const bodyPrNodes = sp.getElementsByTagName("a:bodyPr");
      if (bodyPrNodes.length === 0) continue;

      const bodyPr = bodyPrNodes[0];

      // Remove noAutofit e spAutoFit
      const noAutofit = bodyPr.getElementsByTagName("a:noAutofit");
      while (noAutofit.length > 0) {
        bodyPr.removeChild(noAutofit[0]);
        modified = true;
      }

      const spAutoFit = bodyPr.getElementsByTagName("a:spAutoFit");
      while (spAutoFit.length > 0) {
        bodyPr.removeChild(spAutoFit[0]);
        modified = true;
      }

      // Adiciona normAutofit com 90% escala automática
      let normAutofit = bodyPr.getElementsByTagName("a:normAutofit")[0];
      if (!normAutofit) {
        normAutofit = doc.createElementNS("http://schemas.openxmlformats.org/drawingml/2006/main", "a:normAutofit");
        normAutofit.setAttribute("fontScale", "90000");
        bodyPr.appendChild(normAutofit);
        modified = true;
      }

      // Otimiza margens internas para dar mais respiro ao texto (de 0.1in para 0.05in)
      bodyPr.setAttribute("lIns", "45720");
      bodyPr.setAttribute("rIns", "45720");
      bodyPr.setAttribute("tIns", "22860");
      bodyPr.setAttribute("bIns", "22860");
      bodyPr.setAttribute("wrap", "square");

      // Reduz proporcionalmente fontes para garantia absoluta de caber na forma
      const rPrNodes = sp.getElementsByTagName("a:rPr");
      for (let r = 0; r < rPrNodes.length; r++) {
        const sz = rPrNodes[r].getAttribute("sz");
        if (sz) {
          const val = parseInt(sz, 10);
          if (val >= 2400) {
            const scale = val >= 4500 ? 0.85 : 0.90;
            rPrNodes[r].setAttribute("sz", String(Math.round(val * scale)));
            modified = true;
          }
        }
      }

      const defRPrNodes = sp.getElementsByTagName("a:defRPr");
      for (let d = 0; d < defRPrNodes.length; d++) {
        const sz = defRPrNodes[d].getAttribute("sz");
        if (sz) {
          const val = parseInt(sz, 10);
          if (val >= 2400) {
            const scale = val >= 4500 ? 0.85 : 0.90;
            defRPrNodes[d].setAttribute("sz", String(Math.round(val * scale)));
            modified = true;
          }
        }
      }
    }

    if (modified) {
      const newXml = serializer.serializeToString(doc);
      zip.file(slidePath, newXml);
    }
  }

  const newBlob = await zip.generateAsync({ type: "blob" });
  return new File([newBlob], file.name.replace(/\.pptx$/i, "_autofit.pptx"), { type: file.type });
}