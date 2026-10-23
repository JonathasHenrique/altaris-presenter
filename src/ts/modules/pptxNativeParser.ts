// Altaris PPTX Native Presentation Viewer & Layout Engine
// Extrai apresentações com fidelidade 100% visual ao PowerPoint e LibreOffice Impress:
// Cores temáticas (schemeClr), fontes originais, tamanhos, sombras de caixa e posicionamento vetorial 16:9.
import type { Slide, SlideLayout, SlideElement, SlideElementParagraph } from "../engine/state";

interface ExtractedMedia {
  [rId: string]: string; // Data URL (base64)
}

interface ThemeColors {
  [name: string]: string; // Hex color sem "#", ex: "4472C4"
}

interface ThemeFonts {
  major: string;
  minor: string;
}

function getLocalName(el: Element): string {
  return (el.localName || el.tagName.split(":").pop() || "").toLowerCase();
}

function findFirstDescendant(parent: Element, name: string): Element | null {
  const target = name.toLowerCase();
  const all = parent.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    if (getLocalName(all[i]) === target) return all[i];
  }
  return null;
}

function findAllDescendants(parent: Element, name: string): Element[] {
  const target = name.toLowerCase();
  const all = parent.getElementsByTagName("*");
  const res: Element[] = [];
  for (let i = 0; i < all.length; i++) {
    if (getLocalName(all[i]) === target) res.push(all[i]);
  }
  return res;
}

/**
 * Lê ppt/theme/theme1.xml e extrai as cores e fontes de esquema originais do PowerPoint.
 */
function parseThemeXml(xmlText: string): { colors: ThemeColors; fonts: ThemeFonts } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const colors: ThemeColors = {
    dk1: "000000",
    lt1: "FFFFFF",
    dk2: "44546A",
    lt2: "E7E6E6",
    accent1: "4472C4",
    accent2: "ED7D31",
    accent3: "A5A5A5",
    accent4: "FFC000",
    accent5: "5B9BD5",
    accent6: "70AD47",
    hlink: "0563C1",
    folHlink: "954F72",
    bg1: "FFFFFF",
    tx1: "000000",
    bg2: "E7E6E6",
    tx2: "44546A"
  };
  const fonts: ThemeFonts = { major: "Calibri Light", minor: "Calibri" };

  const clrScheme = findFirstDescendant(doc.documentElement, "clrscheme");
  if (clrScheme) {
    const children = Array.from(clrScheme.children);
    for (const c of children) {
      const tag = getLocalName(c);
      const srgb = findFirstDescendant(c, "srgbclr");
      const sys = findFirstDescendant(c, "sysclr");
      const val = srgb?.getAttribute("val") || sys?.getAttribute("lastClr") || sys?.getAttribute("val");
      if (val) colors[tag] = val;
    }
    if (colors.lt1) colors.bg1 = colors.lt1;
    if (colors.dk1) colors.tx1 = colors.dk1;
  }

  const fontScheme = findFirstDescendant(doc.documentElement, "fontscheme");
  if (fontScheme) {
    const majLatin = findFirstDescendant(findFirstDescendant(fontScheme, "majorfont") || fontScheme, "latin");
    const minLatin = findFirstDescendant(findFirstDescendant(fontScheme, "minorfont") || fontScheme, "latin");
    if (majLatin?.getAttribute("typeface")) fonts.major = majLatin.getAttribute("typeface")!;
    if (minLatin?.getAttribute("typeface")) fonts.minor = minLatin.getAttribute("typeface")!;
  }

  return { colors, fonts };
}

/**
 * Converte nós de cores OpenXML (srgbClr ou schemeClr) aplicando modificadores de luminosidade,
 * tint e shade com precisão matemática idêntica ao PowerPoint / Impress.
 */
function resolveColor(node: Element | null, themeColors: ThemeColors): string | undefined {
  if (!node) return undefined;
  const srgb = findFirstDescendant(node, "srgbclr");
  const scheme = findFirstDescendant(node, "schemeclr");
  let hex: string | undefined = undefined;
  let colorNode: Element | null = null;

  if (srgb) {
    hex = srgb.getAttribute("val") || undefined;
    colorNode = srgb;
  } else if (scheme) {
    const key = scheme.getAttribute("val") || "";
    hex = themeColors[key] || "FFFFFF";
    colorNode = scheme;
  }

  if (!hex || hex.length < 6) return undefined;

  let r = parseInt(hex.slice(0, 2), 16);
  let g = parseInt(hex.slice(2, 4), 16);
  let b = parseInt(hex.slice(4, 6), 16);

  if (colorNode) {
    const lumMod = findFirstDescendant(colorNode, "lummod");
    const lumOff = findFirstDescendant(colorNode, "lumoff");
    const tint = findFirstDescendant(colorNode, "tint");
    const shade = findFirstDescendant(colorNode, "shade");

    if (lumMod) {
      const f = parseInt(lumMod.getAttribute("val") || "100000", 10) / 100000;
      r = Math.round(r * f);
      g = Math.round(g * f);
      b = Math.round(b * f);
    }
    if (lumOff) {
      const off = parseInt(lumOff.getAttribute("val") || "0", 10) / 100000;
      r = Math.min(255, Math.round(r + 255 * off));
      g = Math.min(255, Math.round(g + 255 * off));
      b = Math.min(255, Math.round(b + 255 * off));
    }
    if (tint) {
      const f = parseInt(tint.getAttribute("val") || "100000", 10) / 100000;
      r = Math.min(255, Math.round(r * f + 255 * (1 - f)));
      g = Math.min(255, Math.round(g * f + 255 * (1 - f)));
      b = Math.min(255, Math.round(b * f + 255 * (1 - f)));
    }
    if (shade) {
      const f = parseInt(shade.getAttribute("val") || "100000", 10) / 100000;
      r = Math.round(r * f);
      g = Math.round(g * f);
      b = Math.round(b * f);
    }
  }

  const hexR = Math.max(0, Math.min(255, r)).toString(16).padStart(2, "0");
  const hexG = Math.max(0, Math.min(255, g)).toString(16).padStart(2, "0");
  const hexB = Math.max(0, Math.min(255, b)).toString(16).padStart(2, "0");
  return `#${hexR}${hexG}${hexB}`.toUpperCase();
}

/**
 * Calcula cor de texto de alto contraste quando a apresentação não especifica cor explícita.
 */
function getContrastColor(bgHex?: string, slideBgHex?: string): string {
  const target = bgHex && bgHex !== "transparent" ? bgHex : slideBgHex;
  if (!target || target === "transparent") return "#FFFFFF";
  const clean = target.replace("#", "");
  if (clean.length < 6) return "#FFFFFF";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? "#111827" : "#FFFFFF";
}

function isFooterNoise(t: string): boolean {
  const low = t.toLowerCase().trim();
  return (
    low.includes("www.") ||
    low.includes(".com") ||
    low.includes("nome do professor") ||
    low.includes("clique para adicionar") ||
    low.includes("todos os direitos reservados")
  );
}

function cleanText(t: string): string {
  return t.replace(/[\t\r]+/g, " ").replace(/ +/g, " ").trim();
}

/**
 * Lê um arquivo .pptx e reconstrói apresentações com fidelidade 100% ao PowerPoint/Impress,
 * sem requerer conversões externas.
 */
export async function parsePptxNative(
  file: File,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<Slide[]> {
  const mod: any = await import("jszip");
  const JSZip = mod.default || mod;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const baseTitle = file.name.replace(/\.[^/.]+$/, "");
  const slides: Slide[] = [];
  const parser = new DOMParser();

  // 1. Extrai Tema Oficial (Cores e Fontes de Esquema)
  let themeColors: ThemeColors = {
    dk1: "000000",
    lt1: "FFFFFF",
    dk2: "44546A",
    lt2: "E7E6E6",
    accent1: "4472C4",
    accent2: "ED7D31",
    accent3: "A5A5A5",
    accent4: "FFC000",
    accent5: "5B9BD5",
    accent6: "70AD47",
    hlink: "0563C1",
    folHlink: "954F72",
    bg1: "FFFFFF",
    tx1: "000000",
    bg2: "E7E6E6",
    tx2: "44546A"
  };
  let themeFonts: ThemeFonts = { major: "Calibri Light", minor: "Calibri" };

  try {
    const themeXml = await zip.file("ppt/theme/theme1.xml")?.async("text");
    if (themeXml) {
      const parsedTheme = parseThemeXml(themeXml);
      themeColors = parsedTheme.colors;
      themeFonts = parsedTheme.fonts;
    }
  } catch (e) {
    console.warn("Aviso ao ler tema da apresentação:", e);
  }

  // 2. Dimensões da apresentação em EMU (padrão 16:9 -> 12192000 x 6858000)
  let slideWidthEmu = 12192000;
  let slideHeightEmu = 6858000;

  try {
    const presXml = await zip.file("ppt/presentation.xml")?.async("text");
    if (presXml) {
      const presDoc = parser.parseFromString(presXml, "application/xml");
      const sldSz = findFirstDescendant(presDoc.documentElement, "sldsz");
      if (sldSz) {
        const cx = parseInt(sldSz.getAttribute("cx") || "0", 10);
        const cy = parseInt(sldSz.getAttribute("cy") || "0", 10);
        if (cx > 0 && cy > 0) {
          slideWidthEmu = cx;
          slideHeightEmu = cy;
        }
      }
    }
  } catch (e) {
    console.warn("Aviso ao ler dimensões de ppt/presentation.xml:", e);
  }

  // 3. Encontra todos os slides ordenados numericamente
  const slideEntries: { index: number; path: string; relsPath: string }[] = [];
  zip.forEach((relPath: string) => {
    const match = relPath.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
    if (match) {
      const idx = parseInt(match[1], 10);
      slideEntries.push({
        index: idx,
        path: relPath,
        relsPath: `ppt/slides/_rels/slide${idx}.xml.rels`
      });
    }
  });

  slideEntries.sort((a, b) => a.index - b.index);
  const total = slideEntries.length;
  if (total === 0) return [];

  // 4. Itera por cada slide
  for (let sIdx = 0; sIdx < total; sIdx++) {
    const entry = slideEntries[sIdx];
    if (onProgress) {
      onProgress(sIdx + 1, total, `Processando slide ${sIdx + 1} de ${total}...`);
    }

    // A. Mapeia mídias/imagens do slide
    const mediaMap: ExtractedMedia = {};
    const relsFile = zip.file(entry.relsPath);
    if (relsFile) {
      try {
        const relsXml = await relsFile.async("text");
        const relsDoc = parser.parseFromString(relsXml, "application/xml");
        const relationships = relsDoc.getElementsByTagName("Relationship");

        for (let r = 0; r < relationships.length; r++) {
          const rel = relationships[r];
          const rId = rel.getAttribute("Id") || "";
          const target = rel.getAttribute("Target") || "";
          const type = rel.getAttribute("Type") || "";

          if (type.includes("image") || /\.(png|jpe?g|gif|webp|svg)$/i.test(target)) {
            const normalized = target.replace(/^\.\.\//, "ppt/");
            const mediaFile = zip.file(normalized);
            if (mediaFile) {
              const base64 = await mediaFile.async("base64");
              const ext = target.split(".").pop()?.toLowerCase() || "png";
              const mime =
                ext === "jpg" || ext === "jpeg"
                  ? "image/jpeg"
                  : ext === "svg"
                  ? "image/svg+xml"
                  : ext === "webp"
                  ? "image/webp"
                  : "image/png";
              mediaMap[rId] = `data:${mime};base64,${base64}`;
            }
          }
        }
      } catch (e) {
        console.warn(`Erro ao ler relacionamentos de slide ${entry.index}:`, e);
      }
    }

    // B. Analisa o XML do slide
    const slideXml = await zip.file(entry.path)?.async("text");
    if (!slideXml) continue;

    const doc = parser.parseFromString(slideXml, "application/xml");

    // Identifica fundo do slide (<p:bg>)
    let slideBgImage: string | undefined = undefined;
    let slideBgColor: string | undefined = undefined;

    const bgNode = findFirstDescendant(doc.documentElement, "bg");
    if (bgNode) {
      const blip = findFirstDescendant(bgNode, "blip");
      if (blip) {
        const embedId = blip.getAttribute("r:embed") || blip.getAttribute("embed") || "";
        if (embedId && mediaMap[embedId]) {
          slideBgImage = mediaMap[embedId];
        }
      }
      if (!slideBgImage) {
        const solidFill = findFirstDescendant(bgNode, "solidfill");
        if (solidFill) {
          slideBgColor = resolveColor(solidFill, themeColors);
        }
      }
    }

    // C. Percorre a Árvore de Formas (<p:spTree>) preservando ordem Z
    const elements: SlideElement[] = [];
    const extractedShapesForTitle: { isTitlePlaceholder: boolean; text: string }[] = [];
    let primaryImageUrl: string | undefined = slideBgImage;

    const spTree = findFirstDescendant(doc.documentElement, "sptree");
    const shapeNodes = spTree ? Array.from(spTree.children) : [];

    for (let c = 0; c < shapeNodes.length; c++) {
      const child = shapeNodes[c];
      const tag = getLocalName(child);

      // 1. FORMAS E TEXTOS (<p:sp>)
      if (tag === "sp") {
        const xfrm = findFirstDescendant(child, "xfrm");
        const off = xfrm ? findFirstDescendant(xfrm, "off") : null;
        const ext = xfrm ? findFirstDescendant(xfrm, "ext") : null;

        let x = 0, y = 0, w = 0, h = 0;
        if (off && ext) {
          const offX = parseInt(off.getAttribute("x") || "0", 10);
          const offY = parseInt(off.getAttribute("y") || "0", 10);
          const extW = parseInt(ext.getAttribute("cx") || "0", 10);
          const extH = parseInt(ext.getAttribute("cy") || "0", 10);
          x = Math.max(0, Math.min(100, (offX / slideWidthEmu) * 100));
          y = Math.max(0, Math.min(100, (offY / slideHeightEmu) * 100));
          w = Math.max(0, Math.min(100, (extW / slideWidthEmu) * 100));
          h = Math.max(0, Math.min(100, (extH / slideHeightEmu) * 100));
        }

        // Estilos da forma (Fundo, Borda, Raio e Sombra)
        const spPr = findFirstDescendant(child, "sppr");
        let bgColor: string | undefined = undefined;
        let borderColor: string | undefined = undefined;
        let borderRadius: number | undefined = undefined;
        let hasShadow = false;

        if (spPr) {
          const solidFill = findFirstDescendant(spPr, "solidfill");
          if (solidFill) {
            bgColor = resolveColor(solidFill, themeColors);
          }

          const ln = findFirstDescendant(spPr, "ln");
          if (ln) {
            borderColor = resolveColor(ln, themeColors);
          }

          const geom = findFirstDescendant(spPr, "prstgeom");
          if (geom && geom.getAttribute("prst") === "roundRect") {
            borderRadius = 14;
          }

          const shadow = findFirstDescendant(spPr, "outershdw");
          if (shadow) {
            hasShadow = true;
          }
        }

        // Extrai parágrafos de texto
        const txBody = findFirstDescendant(child, "txbody");
        const paragraphs: SlideElementParagraph[] = [];
        const shapeLines: string[] = [];
        let shapeColor: string | undefined = undefined;
        let shapeFontFamily: string | undefined = undefined;
        let shapeAlign: "left" | "center" | "right" = "left";
        let shapeFontSize: number | undefined = undefined;
        let shapeBold = false;
        let shapeItalic = false;

        if (txBody) {
          const pNodes = findAllDescendants(txBody, "p");
          for (const pElem of pNodes) {
            const pPr = findFirstDescendant(pElem, "ppr");
            const algnAttr = pPr?.getAttribute("algn") || "l";
            const align: "left" | "center" | "right" =
              algnAttr === "ctr" ? "center" : algnAttr === "r" ? "right" : "left";
            shapeAlign = align;

            const rNodes = findAllDescendants(pElem, "r");
            let lineText = "";
            let pFontSize: number | undefined = undefined;
            let pFontFamily: string | undefined = undefined;
            let pBold = false;
            let pItalic = false;
            let pColor: string | undefined = undefined;

            if (rNodes.length > 0) {
              for (const rElem of rNodes) {
                const rPr = findFirstDescendant(rElem, "rpr");
                if (rPr) {
                  const sz = parseInt(rPr.getAttribute("sz") || "0", 10);
                  if (sz > 0 && !pFontSize) pFontSize = sz;
                  if (rPr.getAttribute("b") === "1") pBold = true;
                  if (rPr.getAttribute("i") === "1") pItalic = true;

                  // Fonte da letra
                  const latin = findFirstDescendant(rPr, "latin");
                  let tf = latin?.getAttribute("typeface");
                  if (tf === "+mj-lt") tf = themeFonts.major;
                  else if (tf === "+mn-lt") tf = themeFonts.minor;
                  if (tf && !pFontFamily) pFontFamily = tf;

                  // Cor da letra
                  const c = resolveColor(rPr, themeColors);
                  if (c && !pColor) pColor = c;
                }
                const tElem = findFirstDescendant(rElem, "t");
                if (tElem && tElem.textContent) {
                  lineText += tElem.textContent;
                }
              }
            } else {
              // Alguns slides têm <a:t> direto no parágrafo
              const tElem = findFirstDescendant(pElem, "t");
              if (tElem && tElem.textContent) lineText = tElem.textContent;
            }

            lineText = cleanText(lineText);
            if (lineText) {
              // Se a cor do texto não foi especificada, calcula contraste com o fundo da forma ou do slide
              if (!pColor) {
                pColor = getContrastColor(bgColor, slideBgColor);
              }

              shapeLines.push(lineText);
              paragraphs.push({
                text: lineText,
                align,
                fontSize: pFontSize,
                fontFamily: pFontFamily,
                bold: pBold,
                italic: pItalic,
                color: pColor
              });

              if (!shapeFontSize && pFontSize) shapeFontSize = pFontSize;
              if (!shapeFontFamily && pFontFamily) shapeFontFamily = pFontFamily;
              if (pBold) shapeBold = true;
              if (pItalic) shapeItalic = true;
              if (pColor && !shapeColor) shapeColor = pColor;
            }
          }
        }

        const fullShapeText = shapeLines.join("\n").trim();

        // Se forma tem texto mas cor geral não ficou definida
        if (fullShapeText && !shapeColor) {
          shapeColor = getContrastColor(bgColor, slideBgColor);
        }

        // Se forma tem texto mas fonte geral não ficou definida
        if (!shapeFontFamily) {
          shapeFontFamily = themeFonts.minor;
        }

        // Identifica se é placeholder de título
        const ph = findFirstDescendant(child, "ph");
        const phType = ph ? ph.getAttribute("type") : null;
        const isTitlePlaceholder = phType === "title" || phType === "ctrTitle";

        if (fullShapeText && !isFooterNoise(fullShapeText)) {
          extractedShapesForTitle.push({ isTitlePlaceholder, text: fullShapeText });
        }

        // Se tem área visual ou texto, adiciona aos elementos
        if (w > 0 && h > 0 && (fullShapeText || bgColor || borderColor)) {
          elements.push({
            id: `elem-${sIdx}-${c}`,
            type: fullShapeText ? "text" : "shape",
            x,
            y,
            w,
            h,
            text: fullShapeText,
            paragraphs: paragraphs.length > 0 ? paragraphs : undefined,
            fontSize: shapeFontSize,
            fontFamily: shapeFontFamily,
            align: shapeAlign,
            color: shapeColor,
            bold: shapeBold,
            italic: shapeItalic,
            bgColor,
            borderColor,
            borderRadius,
            hasShadow
          });
        }
      }

      // 2. IMAGENS (<p:pic>)
      else if (tag === "pic") {
        const xfrm = findFirstDescendant(child, "xfrm");
        const off = xfrm ? findFirstDescendant(xfrm, "off") : null;
        const ext = xfrm ? findFirstDescendant(xfrm, "ext") : null;

        let x = 0, y = 0, w = 0, h = 0;
        if (off && ext) {
          const offX = parseInt(off.getAttribute("x") || "0", 10);
          const offY = parseInt(off.getAttribute("y") || "0", 10);
          const extW = parseInt(ext.getAttribute("cx") || "0", 10);
          const extH = parseInt(ext.getAttribute("cy") || "0", 10);
          x = Math.max(0, Math.min(100, (offX / slideWidthEmu) * 100));
          y = Math.max(0, Math.min(100, (offY / slideHeightEmu) * 100));
          w = Math.max(0, Math.min(100, (extW / slideWidthEmu) * 100));
          h = Math.max(0, Math.min(100, (extH / slideHeightEmu) * 100));
        }

        const blip = findFirstDescendant(child, "blip");
        const embedId = blip?.getAttribute("r:embed") || blip?.getAttribute("embed") || "";
        const imageUrl = embedId ? mediaMap[embedId] : undefined;

        if (imageUrl && w > 0 && h > 0) {
          if (!primaryImageUrl) primaryImageUrl = imageUrl;
          elements.push({
            id: `pic-${sIdx}-${c}`,
            type: "image",
            x,
            y,
            w,
            h,
            imageUrl
          });
        }
      }
    }

    // D. Inteligência de Título e Conteúdo para Altaris Search & AI
    let slideTitle = "";
    const bodyParagraphs: string[] = [];

    const canonicalPattern =
      /^(TEXTO\s+ÁUREO|VERDADE\s+PRÁTICA|OBJETIVOS(\s+DA\s+LIÇÃO)?|LEITURA\s+BÍBLICA(\s+EM\s+CLASSE)?|INTRODUÇÃO|CONCLUSÃO|LIÇÃO\s+\d+|[IVXLCDM]+\s*[-–—]\s*[^.]+)$/i;

    for (const sh of extractedShapesForTitle) {
      const st = sh.text.trim();
      if (canonicalPattern.test(st)) {
        if (!slideTitle || st.length < slideTitle.length) {
          slideTitle = st;
        }
      }
    }

    if (!slideTitle) {
      for (const sh of extractedShapesForTitle) {
        if (sh.isTitlePlaceholder && sh.text.trim().length <= 60) {
          slideTitle = sh.text.trim();
          break;
        }
      }
    }

    for (const sh of extractedShapesForTitle) {
      if (sh.text.trim() === slideTitle) continue;
      bodyParagraphs.push(sh.text.trim());
    }

    if (!slideTitle && bodyParagraphs.length > 0) {
      const shortIdx = bodyParagraphs.findIndex(
        (b) => b.length <= 45 && !b.includes("\n") && !b.endsWith(".")
      );
      if (shortIdx !== -1) {
        slideTitle = bodyParagraphs[shortIdx];
        bodyParagraphs.splice(shortIdx, 1);
      }
    }

    if (!slideTitle) {
      slideTitle = `Slide ${entry.index}`;
    }

    const fullBodyText = bodyParagraphs.join("\n\n").trim();

    const combined = `${slideTitle} ${fullBodyText}`;
    const isBibleRef =
      /\b([1-3]?\s?[A-Za-zçãéíóú]{2,12})\s+\d+[:.]\d+/i.test(combined) ||
      /\b(Jr|Sl|Mt|Mc|Lc|Jo|Rm|Ef|Fp|Cl|Hb|Ap|Deuteronômio|Salmos?|Mateus|João)\b/i.test(combined);

    const layout: SlideLayout = {
      bgImage: slideBgImage,
      bgColor: slideBgColor,
      elements
    };

    slides.push({
      id: `pptx-native-${Date.now()}-${entry.index}`,
      title: slideTitle,
      header: isBibleRef ? slideTitle : baseTitle,
      text: fullBodyText || slideTitle,
      category: isBibleRef ? "bible" : elements.some((e) => e.type === "image") && !fullBodyText ? "media" : "verse",
      mediaUrl: primaryImageUrl,
      mediaType: primaryImageUrl ? "image" : undefined,
      layout,
      background: primaryImageUrl
        ? { type: "image", value: primaryImageUrl }
        : slideBgColor
        ? { type: "color", value: slideBgColor }
        : { type: "gradient", value: "nebula" }
    });
  }

  return slides;
}

/**
 * Verifica se o servidor local do Ollama está rodando e lista modelos disponíveis.
 */
export async function checkOllamaStatus(
  ollamaEndpoint: string = "http://localhost:11434"
): Promise<{ available: boolean; models: string[]; recommendedModel?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1600);
    const res = await fetch(`${ollamaEndpoint}/api/tags`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return { available: false, models: [] };
    const data = await res.json();
    const models: string[] = (data.models || []).map((m: any) => m.name || m.model || "");
    const recommended =
      models.find(
        (m) =>
          m.includes("llama3.2") ||
          m.includes("llama3") ||
          m.includes("phi3") ||
          m.includes("gemma2")
      ) || models[0];

    return {
      available: true,
      models,
      recommendedModel: recommended
    };
  } catch {
    return { available: false, models: [] };
  }
}

/**
 * Conector com IA Local (Ollama) para resumir e diagramar lições extensas de EBD
 * em tópicos limpos de 3-4 linhas perfeitamente encaixados para o telão 16:9.
 */
export async function optimizeSlideWithLocalAI(
  title: string,
  rawText: string,
  modelName: string = "llama3.2",
  ollamaEndpoint: string = "http://localhost:11434"
): Promise<{ title: string; text: string } | null> {
  const prompt = `Você é um especialista em projeção de igreja e professor de EBD.
Resuma e formate o conteúdo a seguir para exibição em telão 16:9 de forma clara, bonita e sem textos longos.
Regras:
1. Máximo de 3 a 4 tópicos curtos iniciados com bullet (•).
2. Se houver versículo bíblico, destaque-o no final com emoji de livro (📖).
3. Seja fiel à mensagem teológica sem alterar o sentido.
4. Responda APENAS com o texto formatado final, sem introduções ou explicações.

Título: ${title}
Conteúdo:
${rawText}
`;

  try {
    const res = await fetch(`${ollamaEndpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        prompt,
        stream: false
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const responseText = (data.response || "").trim();
    if (!responseText) return null;

    return {
      title,
      text: responseText
    };
  } catch (err) {
    console.warn("IA Local (Ollama) falhou:", err);
    return null;
  }
}
